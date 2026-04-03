from rq import Connection, Queue, Worker
from redis import Redis

from app.core.config import settings


def run() -> None:
    redis_conn = Redis.from_url(settings.redis_url)
    with Connection(redis_conn):
        worker = Worker([Queue("default")])
        worker.work()


if __name__ == "__main__":
    run()
