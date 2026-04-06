from fastapi import status, HTTPException

class TokenExpiredException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail="token expired")

class TokenNotFoundException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail="token not found")

UserAlreadyExistsException = HTTPException(status_code=status.HTTP_409_CONFLICT, detail="user already exists")
PasswordMismatchException = HTTPException(status_code=status.HTTP_409_CONFLICT, detail="password not match")
IncorrectEmailOrPasswordException = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="incorrect email or password")
NoJwtException = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
NoUserIdException = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user id not found")
ForbiddenException = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

