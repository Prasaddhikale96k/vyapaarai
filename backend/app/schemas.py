from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    unit: str = "pcs"
    sale_price: float
    purchase_price: float
    supplier_phone: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    stock_qty: Optional[float] = None
    reorder_level: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SaleBase(BaseModel):
    date: date
    product_id: int
    customer_id: Optional[int] = None
    qty: float
    unit_price: float
    amount: float
    source: str = "csv"


class SaleCreate(SaleBase):
    pass


class SaleResponse(SaleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    product_id: int
    stock_qty: float = 0
    reorder_level: float = 0
    as_of: Optional[date] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemResponse(InventoryItemBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ReceivableBase(BaseModel):
    customer_id: int
    invoice_no: str
    amount: float
    issue_date: date
    due_date: date
    paid: bool = False
    paid_date: Optional[date] = None
    source: str = "csv"


class ReceivableCreate(ReceivableBase):
    pass


class ReceivableResponse(ReceivableBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ExpenseBase(BaseModel):
    date: date
    category: str
    amount: float
    note: Optional[str] = None
    source: str = "csv"


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseResponse(ExpenseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ActionBase(BaseModel):
    type: str
    title: str
    detail: Optional[str] = None
    target_name: Optional[str] = None
    target_phone: Optional[str] = None
    amount: Optional[float] = None
    draft_message: Optional[str] = None
    status: str = "pending"
    meta: Optional[dict] = None


class ActionCreate(ActionBase):
    pass


class ActionResponse(ActionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentLogBase(BaseModel):
    source: str
    filename: str
    parsed_entries: Optional[List[dict]] = None
    status: str = "pending_confirm"
    language: Optional[str] = None


class DocumentLogCreate(DocumentLogBase):
    pass


class DocumentLogResponse(DocumentLogBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageBase(BaseModel):
    session_phone: str
    role: str
    content: str
    language: Optional[str] = None
    steps: Optional[List[dict]] = None


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageResponse(ChatMessageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IngestionLogBase(BaseModel):
    source_type: str
    filename: str
    rows_inserted: int = 0
    rows_skipped: int = 0
    warnings: Optional[List[str]] = None


class IngestionLogCreate(IngestionLogBase):
    pass


class IngestionLogResponse(IngestionLogBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    app: str


class IngestSummary(BaseModel):
    source_type: str
    filename: str
    rows_inserted: int
    rows_skipped: int
    warnings: List[str]


class ProductWithInventory(BaseModel):
    sku: str
    name: str
    category: str
    sale_price: float
    purchase_price: float
    stock_qty: float
    reorder_level: float

    model_config = ConfigDict(from_attributes=True)


class ResetResponse(BaseModel):
    message: str
    counts: dict