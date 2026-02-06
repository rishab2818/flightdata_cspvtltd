from fastapi import APIRouter, Depends, File, UploadFile

from app.core.auth import CurrentUser, get_current_user
from app.mat.processor import load_numeric_mat_metadata_from_bytes

router = APIRouter(prefix="/api/mat", tags=["mat"])


@router.post("/inspect")
async def inspect_mat(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    data = await file.read()
    variables = load_numeric_mat_metadata_from_bytes(data)
    return {
        "filename": file.filename,
        "variables": [
            {"name": v.name, "shape": v.shape, "dtype": v.dtype, "ndims": v.ndims}
            for v in variables
        ],
    }
