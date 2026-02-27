# from fastapi import APIRouter, Query, Depends
# from typing import Any, Dict, List, Optional
# import re

# from app.db.mongo import get_db

# router = APIRouter(prefix="/api/files", tags=["files"])


# def safe_contains_regex(q: str) -> Dict[str, Any]:
#     """
#     Builds a safe case-insensitive 'contains' regex query.
#     Escapes special regex chars to avoid regex injection / expensive patterns.
#     """
#     q = (q or "").strip()
#     q = re.escape(q)
#     return {"$regex": q, "$options": "i"}


# def normalize_file_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
#     """
#     Normalize any doc shape into:
#     {id, file_name, download_url, project_name?}
#     """
#     _id = doc.get("_id")
#     out = {
#         "id": str(_id) if _id is not None else None,
#         "file_name": doc.get("file_name") or doc.get("name") or doc.get("filename") or "Untitled",
#         "download_url": doc.get("download_url") or doc.get("downloadUrl") or doc.get("url"),
#     }
#     if "project_name" in doc and doc.get("project_name") is not None:
#         out["project_name"] = doc.get("project_name")
#     return out


# @router.get("/search")
# async def search_all_files(
#     q: str = Query(..., min_length=1),
#     limit: int = Query(50, ge=1, le=200),
#     skip: int = Query(0, ge=0),
#     include_project_name: bool = Query(True),
#     project_id: Optional[str] = Query(None),
#     db=Depends(get_db),
# ) -> List[Dict[str, Any]]:
#     """
#     Global search across all projects (documents/records/files collections).
#     Returns list of {id, file_name, download_url, project_name?}
#     """

#     rx = safe_contains_regex(q)

#     # try common filename fields
#     base_match: Dict[str, Any] = {
#         "$or": [
#             {"file_name": rx},
#             {"name": rx},
#             {"filename": rx},
#         ]
#     }

#     # optional filter by project_id
#     if project_id:
#         # support both "project_id" and "projectId" depending on schema
#         base_match["$and"] = base_match.get("$and", [])
#         base_match["$and"].append({
#             "$or": [{"project_id": project_id}, {"projectId": project_id}]
#         })

#     # collections to search (adjust if needed)
#     collections_to_search = ["files", "documents", "records"]

#     results: List[Dict[str, Any]] = []

#     # Optional: build a lookup to projects for project_name
#     # We do it only if your docs have project_id and your projects collection exists.
#     lookup_pipeline: List[Dict[str, Any]] = []
#     if include_project_name:
#         lookup_pipeline = [
#             {
#                 "$lookup": {
#                     "from": "projects",
#                     # Many apps store file.project_id as string, while projects._id is ObjectId.
#                     # So we also attempt string compare by adding a string version of _id below.
#                     "let": {"pid": {"$ifNull": ["$project_id", "$projectId"]}},
#                     "pipeline": [
#                         # compare both raw _id and stringified _id
#                         {
#                             "$addFields": {"_id_str": {"$toString": "$_id"}}
#                         },
#                         {
#                             "$match": {
#                                 "$expr": {
#                                     "$or": [
#                                         {"$eq": ["$_id_str", "$$pid"]},
#                                         {"$eq": ["$_id", "$$pid"]},
#                                     ]
#                                 }
#                             }
#                         },
#                         {"$project": {"project_name": 1}},
#                     ],
#                     "as": "project_doc",
#                 }
#             },
#             {"$unwind": {"path": "$project_doc", "preserveNullAndEmptyArrays": True}},
#             {"$addFields": {"project_name": "$project_doc.project_name"}},
#             {"$project": {"project_doc": 0}},
#         ]

#     for col_name in collections_to_search:
#         col = db.get(col_name)
#         if col is None:
#             continue

#         pipeline: List[Dict[str, Any]] = [
#             {"$match": base_match},
#             {"$sort": {"updated_at": -1, "created_at": -1}},
#             {"$skip": skip},
#             {"$limit": limit},
#             {
#                 "$project": {
#                     "_id": 1,
#                     "file_name": 1,
#                     "name": 1,
#                     "filename": 1,
#                     "download_url": 1,
#                     "downloadUrl": 1,
#                     "url": 1,
#                     "project_id": 1,
#                     "projectId": 1,
#                 }
#             },
#         ]

#         if include_project_name:
#             pipeline.extend(lookup_pipeline)

#         try:
#             cursor = col.aggregate(pipeline)
#             async for doc in cursor:
#                 results.append(normalize_file_doc(doc))
#         except Exception:
#             # If a collection doesn't support aggregate (unlikely) or schema mismatch,
#             # ignore and continue
#             continue

#     # de-duplicate by id (same file could appear in multiple collections)
#     seen = set()
#     unique: List[Dict[str, Any]] = []
#     for r in results:
#         rid = r.get("id")
#         if rid and rid in seen:
#             continue
#         if rid:
#             seen.add(rid)
#         unique.append(r)

#     # cap to limit overall (since we searched multiple collections)
#     return unique[:limit]