from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Float, ForeignKey, Integer, String, Text, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Case(Base):
    __tablename__ = "cases"

    case_id               = Column(String(32),  primary_key=True)
    case_number           = Column(String(50))
    created_at            = Column(TIMESTAMP, nullable=False, server_default=func.now())
    started_at            = Column(TIMESTAMP)
    ended_at              = Column(TIMESTAMP)
    investigator          = Column(String(255), nullable=False)
    location              = Column(String(255))
    threat_level          = Column(String(20))
    status                = Column(String(20),  nullable=False, default="pending")
    sealed                = Column(Boolean,     nullable=False, default=False)
    blockchain_case_tx_id = Column(String(66))

    events  = relationship("Event",  back_populates="case", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id         = Column(Integer,     primary_key=True, autoincrement=True)
    case_id    = Column(String(32),  ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50),  nullable=False)
    severity   = Column(String(20),  nullable=False)
    summary    = Column(Text,        nullable=False)
    detail     = Column(Text)
    timestamp  = Column(TIMESTAMP,   nullable=False)
    sensors    = Column(JSONB)
    subject_id = Column(String(10))
    zone       = Column(String(50))
    confidence = Column(Float)
    approved   = Column(Boolean,     nullable=False, default=True)

    case = relationship("Case", back_populates="events")


class Report(Base):
    __tablename__ = "reports"

    report_id               = Column(Integer,    primary_key=True, autoincrement=True)
    case_id                 = Column(String(32), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at            = Column(TIMESTAMP,  nullable=False, server_default=func.now())
    threat_assessment       = Column(JSONB)
    narrative               = Column(Text)
    key_findings            = Column(JSONB)
    subject_profiles        = Column(JSONB)
    evidence_chain          = Column(JSONB)
    recommendation          = Column(Text)
    blockchain_report_hash  = Column(String(66))
    blockchain_report_tx_id = Column(String(66))

    case = relationship("Case", back_populates="reports")


class BlockchainRecord(Base):
    __tablename__ = "blockchain_records"

    id          = Column(Integer,    primary_key=True, autoincrement=True)
    record_type = Column(String(50), nullable=False)
    related_id  = Column(String(66), nullable=False, index=True)
    tx_hash     = Column(String(66), nullable=False)
    block_number = Column(Integer)
    timestamp   = Column(TIMESTAMP,  nullable=False, server_default=func.now())
    record_metadata    = Column(JSONB)
