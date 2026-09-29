import json
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Float,
    Text,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from app.db import Base


def _owner_col():
    """owner_id FK-ish int, default 1, indexed. FK constraint nahi (sqlite/PG dono safe)."""
    return Column(Integer, default=1, index=True, nullable=False)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    sku = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False)
    unit = Column(String(16), default="pcs", nullable=False)
    sale_price = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=False)
    supplier_phone = Column(String(32), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    inventory = relationship("InventoryItem", back_populates="product", uselist=False)
    sales = relationship("Sale", back_populates="product")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    name = Column(String(128), index=True, nullable=False)
    phone = Column(String(32), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    sales = relationship("Sale", back_populates="customer")
    receivables = relationship("Receivable", back_populates="customer")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    date = Column(Date, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    qty = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    source = Column(String(16), default="csv", nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "date", "product_id", "customer_id", "qty", "amount",
            name="uq_sale_dedup"
        ),
    )

    product = relationship("Product", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")


class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    stock_qty = Column(Float, default=0, nullable=False)
    reorder_level = Column(Float, default=0, nullable=False)
    as_of = Column(Date, nullable=True)

    product = relationship("Product", back_populates="inventory")


class Receivable(Base):
    __tablename__ = "receivables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_no = Column(String(64), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    paid = Column(Boolean, default=False, nullable=False)
    paid_date = Column(Date, nullable=True)
    source = Column(String(16), default="csv", nullable=False)

    customer = relationship("Customer", back_populates="receivables")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    date = Column(Date, index=True, nullable=False)
    category = Column(String(64), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(Text, nullable=True)
    source = Column(String(16), default="csv", nullable=False)


class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    type = Column(String(32), nullable=False)
    title = Column(String(128), nullable=False)
    detail = Column(Text, nullable=True)
    target_name = Column(String(128), nullable=True)
    target_phone = Column(String(32), nullable=True)
    amount = Column(Float, nullable=True)
    draft_message = Column(Text, nullable=True)
    status = Column(String(16), default="pending", nullable=False)
    meta = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def get_meta(self) -> dict:
        if self.meta:
            try:
                return json.loads(self.meta)
            except json.JSONDecodeError:
                return {}
        return {}

    def set_meta(self, data: dict):
        self.meta = json.dumps(data)


class DocumentLog(Base):
    __tablename__ = "document_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    source = Column(String(16), nullable=False)
    filename = Column(String(256), nullable=False)
    parsed_entries = Column(Text, nullable=True)
    status = Column(String(20), default="pending_confirm", nullable=False)
    language = Column(String(8), nullable=True)
    phone = Column(String(32), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OwnerProfile(Base):
    __tablename__ = "owner_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=True)
    business_name = Column(String(128), nullable=True)
    language = Column(String(8), default="hi", nullable=False)
    # --- Phase A access control ---
    allowed = Column(Boolean, default=False, nullable=False)
    onboarded = Column(Boolean, default=False, nullable=False)
    distributor_phone = Column(String(32), nullable=True)
    reg_step = Column(String(16), nullable=True)  # NAME|BUSINESS|CATEGORY|DISTRIBUTOR|LANGUAGE|OTP
    otp_code = Column(String(16), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=False)
    # --- Phase B: UPI collections ---
    upi_vpa = Column(String(64), nullable=True)
    # --- P15: business taxonomy + multi-distributor ---
    business_type = Column(String(32), nullable=True)
    distributors = Column(Text, nullable=True)  # JSON array of phone strings
    # --- one-shot P1: one-time morning nudge for activated-but-not-onboarded ---
    nudge_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_phone = Column(String(32), index=True, nullable=False)
    owner_id = Column(Integer, default=1, index=True, nullable=False)
    source = Column(String(8), default="web", nullable=False)  # web|whatsapp
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    language = Column(String(8), nullable=True)
    steps = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class IngestionLog(Base):
    __tablename__ = "ingestion_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    source_type = Column(String(32), nullable=False)
    filename = Column(String(256), nullable=False)
    rows_inserted = Column(Integer, default=0, nullable=False)
    rows_skipped = Column(Integer, default=0, nullable=False)
    warnings = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    def get_warnings(self) -> list:
        if self.warnings:
            try:
                return json.loads(self.warnings)
            except json.JSONDecodeError:
                return []
        return []

    def set_warnings(self, warnings: list):
        self.warnings = json.dumps(warnings)


class ProcessedFile(Base):
    __tablename__ = "processed_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    filename = Column(String(256), nullable=False)
    sha256 = Column(String(64), index=True, nullable=False)
    size = Column(Integer, default=0, nullable=False)
    source = Column(String(16), default="watch", nullable=False)
    status = Column(String(16), default="ingested", nullable=False)
    rows_inserted = Column(Integer, default=0, nullable=False)
    warnings = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class Connector(Base):
    __tablename__ = "connectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    type = Column(String(24), nullable=False)  # google_sheets | excel_agent | tally_agent
    config = Column(Text, nullable=True)  # JSON string
    status = Column(String(16), default="offline", nullable=False)  # live | polling | offline | error
    last_sync_at = Column(DateTime, nullable=True)
    rows_synced = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class VoiceLog(Base):
    __tablename__ = "voice_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    duration_s = Column(Integer, default=0, nullable=False)
    language = Column(String(8), nullable=True)
    transcript = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = _owner_col()
    kind = Column(String(16), default="other", nullable=False)  # supplier|customer|distributor|other
    name = Column(String(128), nullable=False)
    phone = Column(String(32), index=True, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)