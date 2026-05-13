from collections import defaultdict
from starlette.requests import Request
import time


class RateLimiter:
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _cleanup(self, key: str, window: int) -> None:
        now = time.time()
        self._requests[key] = [
            t for t in self._requests[key] if now - t < window
        ]

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        self._cleanup(key, window_seconds)
        now = time.time()

        if len(self._requests[key]) >= max_requests:
            oldest = min(self._requests[key])
            retry_after = int(oldest + window_seconds - now)
            return False, max(1, retry_after)

        self._requests[key].append(now)
        return True, 0

    def reset(self, key: str) -> None:
        self._requests.pop(key, None)


rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
