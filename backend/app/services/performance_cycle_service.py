from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.models.performance import PerformanceFrequency, ReviewCycleStatus


FREQUENCY_MONTHS = {
    PerformanceFrequency.MONTHLY.value: 1,
    PerformanceFrequency.QUARTERLY.value: 3,
    PerformanceFrequency.HALF_YEARLY.value: 6,
    PerformanceFrequency.YEARLY.value: 12,
}


def _to_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _to_datetime(value: date) -> datetime:
    return datetime.combine(value, time.min)


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    days_in_month = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ][month - 1]
    return date(year, month, min(value.day, days_in_month))


@dataclass
class PerformanceCycleService:
    db: Any
    organization_id: str = "default"

    @property
    def settings_collection(self):
        return self.db.performance_settings

    @property
    def cycles_collection(self):
        return self.db.review_cycles

    async def ensure_indexes(self) -> None:
        await self.cycles_collection.create_index(
            [
                ("organization_id", ASCENDING),
                ("start_date", ASCENDING),
                ("end_date", ASCENDING),
            ],
            unique=True,
            name="uniq_review_cycle_period",
        )
        await self.cycles_collection.create_index(
            [("organization_id", ASCENDING), ("status", ASCENDING)],
            name="idx_review_cycle_status",
        )
        await self.settings_collection.create_index(
            [("organization_id", ASCENDING)],
            unique=True,
            name="uniq_performance_settings_org",
        )

    def normalize_frequency(self, frequency: str | PerformanceFrequency) -> str:
        value = frequency.value if isinstance(frequency, PerformanceFrequency) else frequency
        normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "month": "monthly",
            "quarter": "quarterly",
            "half_year": "half_yearly",
            "halfyearly": "half_yearly",
            "half_year": "half_yearly",
            "half-yearly": "half_yearly",
            "annual": "yearly",
            "annually": "yearly",
            "year": "yearly",
        }
        normalized = aliases.get(normalized, normalized)
        if normalized not in FREQUENCY_MONTHS:
            raise ValueError("Unsupported evaluation frequency")
        return normalized

    def calculate_cycle_end_date(
        self, start_date: date, frequency: str | PerformanceFrequency
    ) -> date:
        normalized = self.normalize_frequency(frequency)
        return _add_months(start_date, FREQUENCY_MONTHS[normalized]) - timedelta(days=1)

    def calculate_next_cycle(self, cycle: dict) -> dict:
        frequency = self.normalize_frequency(cycle["frequency"])
        next_start = _to_date(cycle["end_date"]) + timedelta(days=1)
        next_end = self.calculate_cycle_end_date(next_start, frequency)
        return {
            "organization_id": cycle["organization_id"],
            "start_date": _to_datetime(next_start),
            "end_date": _to_datetime(next_end),
            "status": ReviewCycleStatus.ACTIVE.value,
            "frequency": frequency,
            "sequence_number": int(cycle.get("sequence_number", 1)) + 1,
        }

    async def get_settings(self) -> Optional[dict]:
        return await self.settings_collection.find_one(
            {"organization_id": self.organization_id}
        )

    async def save_settings(
        self, frequency: str | PerformanceFrequency, first_cycle_start_date: date
    ) -> dict:
        await self.ensure_indexes()
        normalized = self.normalize_frequency(frequency)
        first_cycle_end_date = self.calculate_cycle_end_date(
            first_cycle_start_date, normalized
        )
        now = datetime.utcnow()
        settings = await self.settings_collection.find_one_and_update(
            {"organization_id": self.organization_id},
            {
                "$set": {
                    "organization_id": self.organization_id,
                    "frequency": normalized,
                    "first_cycle_start_date": _to_datetime(first_cycle_start_date),
                    "first_cycle_end_date": _to_datetime(first_cycle_end_date),
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        await self._create_or_get_cycle(
            first_cycle_start_date,
            first_cycle_end_date,
            normalized,
            1,
            ReviewCycleStatus.ACTIVE.value,
        )
        await self.ensure_current_cycle_exists(as_of=date.today())
        return settings

    async def get_current_cycle(self, as_of: Optional[date] = None) -> Optional[dict]:
        await self.ensure_indexes()
        target = as_of or date.today()
        target_dt = _to_datetime(target)
        return await self.cycles_collection.find_one(
            {
                "organization_id": self.organization_id,
                "start_date": {"$lte": target_dt},
                "end_date": {"$gte": target_dt},
            },
            sort=[("start_date", -1)],
        )

    async def ensure_current_cycle_exists(
        self, as_of: Optional[date] = None
    ) -> Optional[dict]:
        await self.ensure_indexes()
        settings = await self.get_settings()
        if not settings:
            return None

        target = as_of or date.today()
        frequency = self.normalize_frequency(settings["frequency"])
        start = _to_date(settings["first_cycle_start_date"])
        end = self.calculate_cycle_end_date(start, frequency)
        sequence = 1

        current = await self._create_or_get_cycle(
            start, end, frequency, sequence, ReviewCycleStatus.ACTIVE.value
        )

        while _to_date(current["end_date"]) < target:
            await self._complete_cycle(current)
            next_cycle = self.calculate_next_cycle(current)
            current = await self._create_or_get_cycle(
                _to_date(next_cycle["start_date"]),
                _to_date(next_cycle["end_date"]),
                next_cycle["frequency"],
                next_cycle["sequence_number"],
                ReviewCycleStatus.ACTIVE.value,
            )

        await self._activate_only(current)
        return current

    async def create_next_cycle_if_required(
        self, as_of: Optional[date] = None
    ) -> Optional[dict]:
        return await self.ensure_current_cycle_exists(as_of=as_of)

    async def _create_or_get_cycle(
        self,
        start_date: date,
        end_date: date,
        frequency: str,
        sequence_number: int,
        status: str,
    ) -> dict:
        now = datetime.utcnow()
        query = {
            "organization_id": self.organization_id,
            "start_date": _to_datetime(start_date),
            "end_date": _to_datetime(end_date),
        }
        doc = {
            **query,
            "frequency": frequency,
            "sequence_number": sequence_number,
            "status": status,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await self.cycles_collection.insert_one(doc)
            return doc
        except DuplicateKeyError:
            return await self.cycles_collection.find_one(query)

    async def _complete_cycle(self, cycle: dict) -> None:
        if cycle.get("status") in {
            ReviewCycleStatus.COMPLETED.value,
            ReviewCycleStatus.CLOSED.value,
        }:
            return
        await self.cycles_collection.update_one(
            {"_id": cycle["_id"]},
            {
                "$set": {
                    "status": ReviewCycleStatus.COMPLETED.value,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    async def _activate_only(self, cycle: dict) -> None:
        await self.cycles_collection.update_many(
            {
                "organization_id": self.organization_id,
                "_id": {"$ne": cycle["_id"]},
                "status": ReviewCycleStatus.ACTIVE.value,
            },
            {
                "$set": {
                    "status": ReviewCycleStatus.COMPLETED.value,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        if cycle.get("status") != ReviewCycleStatus.ACTIVE.value:
            await self.cycles_collection.update_one(
                {"_id": cycle["_id"]},
                {
                    "$set": {
                        "status": ReviewCycleStatus.ACTIVE.value,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
