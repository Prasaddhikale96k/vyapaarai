import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import InventoryItem, Product
from app.routers.auth import get_optional_owner, owner_id_of, require_admin
from app.schemas import ProductWithInventory, ResetResponse

router = APIRouter(tags=["data"])


@router.get("/products", response_model=list[ProductWithInventory])
def list_products(db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    rows = (
        db.query(Product, InventoryItem)
        .outerjoin(InventoryItem, (InventoryItem.product_id == Product.id)
                   & (InventoryItem.owner_id == oid))
        .filter(Product.owner_id == oid)
        .order_by(Product.name)
        .all()
    )
    return [
        ProductWithInventory(
            sku=p.sku,
            name=p.name,
            category=p.category,
            sale_price=p.sale_price,
            purchase_price=p.purchase_price,
            stock_qty=inv.stock_qty if inv else 0.0,
            reorder_level=inv.reorder_level if inv else 0.0,
        )
        for p, inv in rows
    ]


def _load_seed_module():
    backend_root = Path(__file__).resolve().parents[2]
    seed_path = backend_root / "seed_demo_data.py"
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))
    spec = importlib.util.spec_from_file_location("seed_demo_data", seed_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("seed_demo_data.py not found")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["seed_demo_data"] = mod
    spec.loader.exec_module(mod)
    return mod


@router.post("/data/reset", response_model=ResetResponse)
def reset_data(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    db.close()  # release request session; seed uses its own sessions
    mod = _load_seed_module()
    counts = mod.run_seed()
    # ensure counts has plain ints
    counts = {k: int(v) for k, v in counts.items()}
    return ResetResponse(message="database reset and reseeded", counts=counts)
