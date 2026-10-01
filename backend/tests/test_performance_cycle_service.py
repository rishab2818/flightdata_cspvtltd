import asyncio
from datetime import date

import pytest
from pymongo.errors import DuplicateKeyError

from app.services.performance_cycle_service import PerformanceCycleService


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class FakeCollection:
    def __init__(self):
        self.rows = []
        self.next_id = 1

    async def create_index(self, *args, **kwargs):
        return kwargs.get("name", "idx")

    def _matches(self, row, query):
        for key, expected in query.items():
            actual = row.get(key)
            if isinstance(expected, dict):
                if "$lte" in expected and not actual <= expected["$lte"]:
                    return False
                if "$gte" in expected and not actual >= expected["$gte"]:
                    return False
                if "$ne" in expected and actual == expected["$ne"]:
                    return False
            elif actual != expected:
                return False
        return True

    async def find_one(self, query, sort=None):
        rows = [row for row in self.rows if self._matches(row, query)]
        if sort:
            field, direction = sort[0]
            rows.sort(key=lambda row: row[field], reverse=direction < 0)
        return rows[0] if rows else None

    async def insert_one(self, doc):
        for row in self.rows:
            if (
                row.get("organization_id") == doc.get("organization_id")
                and row.get("start_date") == doc.get("start_date")
                and row.get("end_date") == doc.get("end_date")
            ):
                raise DuplicateKeyError("duplicate")
        saved = {**doc, "_id": self.next_id}
        self.next_id += 1
        self.rows.append(saved)
        doc["_id"] = saved["_id"]
        return InsertResult(saved["_id"])

    async def update_one(self, query, update):
        row = await self.find_one(query)
        if row:
            row.update(update.get("$set", {}))

    async def update_many(self, query, update):
        for row in self.rows:
            if self._matches(row, query):
                row.update(update.get("$set", {}))

    async def find_one_and_update(self, query, update, upsert=False, return_document=None):
        row = await self.find_one(query)
        if not row and upsert:
            row = {"_id": self.next_id, **query, **update.get("$setOnInsert", {})}
            self.next_id += 1
            self.rows.append(row)
        row.update(update.get("$set", {}))
        return row


class FakeDb:
    def __init__(self):
        self.performance_settings = FakeCollection()
        self.review_cycles = FakeCollection()


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize(
    ("frequency", "start", "end"),
    [
        ("monthly", date(2026, 9, 1), date(2026, 9, 30)),
        ("quarterly", date(2026, 7, 1), date(2026, 9, 30)),
        ("half_yearly", date(2026, 7, 1), date(2026, 12, 31)),
        ("yearly", date(2026, 4, 1), date(2027, 3, 31)),
    ],
)
def test_calculate_cycle_end_date(frequency, start, end):
    service = PerformanceCycleService(FakeDb())

    assert service.calculate_cycle_end_date(start, frequency) == end


def test_ensure_current_cycle_is_idempotent():
    async def scenario():
        db = FakeDb()
        service = PerformanceCycleService(db)
        await service.save_settings("quarterly", date(2026, 7, 1))

        first = await service.ensure_current_cycle_exists(as_of=date(2026, 8, 1))
        second = await service.ensure_current_cycle_exists(as_of=date(2026, 8, 1))

        assert first["_id"] == second["_id"]
        assert len(db.review_cycles.rows) == 1

    run(scenario())


def test_server_downtime_advances_to_cycle_containing_today():
    async def scenario():
        db = FakeDb()
        service = PerformanceCycleService(db)
        await service.save_settings("quarterly", date(2026, 7, 1))

        current = await service.ensure_current_cycle_exists(as_of=date(2027, 2, 5))

        assert current["start_date"].date() == date(2027, 1, 1)
        assert current["end_date"].date() == date(2027, 3, 31)
        assert current["status"] == "active"
        assert [row["status"] for row in db.review_cycles.rows] == [
            "completed",
            "completed",
            "active",
        ]

    run(scenario())


def test_next_cycle_created_after_cycle_end_without_changing_old_dates():
    async def scenario():
        db = FakeDb()
        service = PerformanceCycleService(db)
        await service.save_settings("monthly", date(2026, 9, 1))
        old_cycle = await service.ensure_current_cycle_exists(as_of=date(2026, 9, 15))

        current = await service.create_next_cycle_if_required(as_of=date(2026, 10, 5))

        assert old_cycle["start_date"].date() == date(2026, 9, 1)
        assert old_cycle["end_date"].date() == date(2026, 9, 30)
        assert current["start_date"].date() == date(2026, 10, 1)
        assert current["end_date"].date() == date(2026, 10, 31)
        assert len(db.review_cycles.rows) == 2

    run(scenario())
