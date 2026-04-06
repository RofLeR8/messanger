from fastapi.exceptions import HTTPException
from fastapi import status

ChatNoFoundException = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="chat not found")
