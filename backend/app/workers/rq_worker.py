import sys

from redis import Redis
from rq import Queue, Worker
from rq.worker import SimpleWorker

from app.core.config import settings


def run() -> None:
    redis_conn = Redis.from_url(settings.redis_url)
    queue = Queue("default", connection=redis_conn)
    worker_cls = SimpleWorker if sys.platform == "darwin" else Worker
    worker = worker_cls([queue], connection=redis_conn)
    worker.work()


if __name__ == "__main__":
    run()
