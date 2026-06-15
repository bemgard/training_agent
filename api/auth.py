import os
import bcrypt
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "").encode()
fernet = Fernet(ENCRYPTION_KEY) if ENCRYPTION_KEY else None

def hasha_lösenord(lösenord: str) -> str:
    return bcrypt.hashpw(lösenord.encode(), bcrypt.gensalt()).decode()

def verifiera_lösenord(lösenord: str, hash: str) -> bool:
    return bcrypt.checkpw(lösenord.encode(), hash.encode())

def kryptera(text: str) -> str:
    if not fernet:
        raise ValueError("ENCRYPTION_KEY saknas")
    return fernet.encrypt(text.encode()).decode()

def dekryptera(krypterad: str) -> str:
    if not fernet:
        raise ValueError("ENCRYPTION_KEY saknas")
    return fernet.decrypt(krypterad.encode()).decode()