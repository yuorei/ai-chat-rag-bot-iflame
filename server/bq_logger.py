"""BigQuery logging module for chat events."""

import os
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from queue import Empty, Queue
from typing import Optional

# Environment variables
BQ_ENABLED = os.getenv('BQ_ENABLED', 'false').lower() == 'true'
GCP_PROJECT_ID = os.getenv('GCP_PROJECT_ID', '')
BQ_DATASET_ID = os.getenv('BQ_DATASET_ID', 'ai_chat_logs')
BQ_BATCH_SIZE = int(os.getenv('BQ_BATCH_SIZE', '100'))
BQ_FLUSH_INTERVAL_SEC = int(os.getenv('BQ_FLUSH_INTERVAL_SEC', '10'))


@dataclass
class ChatbotEvent:
    """Data class for chatbot events."""
    event_id: str
    event_type: str
    event_timestamp: str
    chat_id: str
    request_id: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    origin_domain: Optional[str] = None
    message_length: Optional[int] = None
    message_content: Optional[str] = None
    response_content: Optional[str] = None
    context_found: Optional[bool] = None
    context_sources_count: Optional[int] = None
    vector_search_duration_ms: Optional[int] = None
    top_similarity_score: Optional[float] = None
    llm_model: Optional[str] = None
    llm_request_duration_ms: Optional[int] = None
    response_length: Optional[int] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    total_duration_ms: Optional[int] = None

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering out None values for optional fields."""
        result = {}
        for k, v in asdict(self).items():
            if v is not None:
                result[k] = v
        return result


class BigQueryLogger:
    """Async batch logger for BigQuery."""

    def __init__(
        self,
        project_id: str,
        dataset_id: str,
        batch_size: int = 100,
        flush_interval: int = 10,
    ):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._queue: Queue = Queue()
        self._client = None
        self._enabled = False
        self._shutdown = False
        self._flush_thread: Optional[threading.Thread] = None

        self._init_client()

    def _init_client(self):
        """Initialize BigQuery client."""
        if not self.project_id:
            print("BigQuery logging disabled: GCP_PROJECT_ID not set")
            return

        try:
            from google.cloud import bigquery
            self._client = bigquery.Client(project=self.project_id)
            self._enabled = True
            self._start_flush_thread()
            print(f"BigQuery logging enabled: project={self.project_id}, dataset={self.dataset_id}")
        except ImportError:
            print("BigQuery logging disabled: google-cloud-bigquery not installed")
        except Exception as e:
            print(f"BigQuery client init failed, logging disabled: {e}")

    def _start_flush_thread(self):
        """Start background thread for periodic flushing."""
        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()

    def _flush_loop(self):
        """Background loop to flush events periodically."""
        while not self._shutdown:
            try:
                self._flush_batch()
            except Exception as e:
                print(f"BigQuery flush error: {e}")

            # Wait for next flush interval, but check shutdown more frequently
            for _ in range(self.flush_interval * 10):
                if self._shutdown:
                    break
                threading.Event().wait(0.1)

    def _flush_batch(self):
        """Flush accumulated events to BigQuery."""
        if not self._enabled or not self._client:
            # Drain queue if disabled
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                except Empty:
                    break
            return

        events = []
        while len(events) < self.batch_size:
            try:
                table_id, event_dict = self._queue.get_nowait()
                events.append((table_id, event_dict))
            except Empty:
                break

        if not events:
            return

        # Group events by table
        by_table: dict = {}
        for table_id, event_dict in events:
            if table_id not in by_table:
                by_table[table_id] = []
            by_table[table_id].append(event_dict)

        # Insert into each table
        for table_id, rows in by_table.items():
            try:
                table_ref = f"{self.project_id}.{self.dataset_id}.{table_id}"
                errors = self._client.insert_rows_json(table_ref, rows)
                if errors:
                    print(f"BigQuery insert errors for {table_id}: {errors[:3]}")
                else:
                    print(f"BigQuery: inserted {len(rows)} rows into {table_id}")
            except Exception as e:
                print(f"BigQuery insert failed for {table_id}: {e}")

    def log_chat_event(self, event: ChatbotEvent):
        """Queue a chatbot event for logging."""
        if not self._enabled:
            return
        self._queue.put(('chatbot_events', event.to_dict()))

    def shutdown(self):
        """Gracefully shutdown the logger, flushing remaining events."""
        self._shutdown = True
        if self._flush_thread:
            self._flush_thread.join(timeout=5)
        # Final flush
        self._flush_batch()


# Global singleton
_logger: Optional[BigQueryLogger] = None


def get_logger() -> Optional[BigQueryLogger]:
    """Get or create the global BigQuery logger instance."""
    global _logger
    if _logger is None and BQ_ENABLED:
        _logger = BigQueryLogger(
            project_id=GCP_PROJECT_ID,
            dataset_id=BQ_DATASET_ID,
            batch_size=BQ_BATCH_SIZE,
            flush_interval=BQ_FLUSH_INTERVAL_SEC,
        )
    return _logger


def create_chat_event(
    chat_id: str,
    event_type: str = 'chat_request',
    request_id: Optional[str] = None,
    **kwargs
) -> ChatbotEvent:
    """Helper function to create a ChatbotEvent with auto-generated fields."""
    return ChatbotEvent(
        event_id=str(uuid.uuid4()),
        event_type=event_type,
        event_timestamp=datetime.utcnow().isoformat() + 'Z',
        chat_id=chat_id,
        request_id=request_id or str(uuid.uuid4()),
        **kwargs
    )


def log_chat_request(
    chat_id: str,
    query: str,
    response: str,
    request_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    origin_domain: Optional[str] = None,
    context_found: bool = False,
    context_sources_count: int = 0,
    vector_search_duration_ms: Optional[int] = None,
    top_similarity_score: Optional[float] = None,
    llm_model: Optional[str] = None,
    llm_request_duration_ms: Optional[int] = None,
    total_duration_ms: Optional[int] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
):
    """Convenience function to log a chat request event."""
    logger = get_logger()
    if not logger:
        return

    event = create_chat_event(
        chat_id=chat_id,
        event_type='chat_request',
        request_id=request_id,
        client_ip=client_ip,
        user_agent=user_agent,
        origin_domain=origin_domain,
        message_length=len(query) if query else 0,
        message_content=query,
        response_content=response,
        response_length=len(response) if response else 0,
        context_found=context_found,
        context_sources_count=context_sources_count,
        vector_search_duration_ms=vector_search_duration_ms,
        top_similarity_score=top_similarity_score,
        llm_model=llm_model,
        llm_request_duration_ms=llm_request_duration_ms,
        total_duration_ms=total_duration_ms,
        error_code=error_code,
        error_message=error_message,
    )
    logger.log_chat_event(event)
