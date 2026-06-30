import logging
import os
from app.config import settings

logger = logging.getLogger("app.storage")

class StorageService:
    def __init__(self):
        try:
            import firebase_admin
            from firebase_admin import storage
            if not firebase_admin._apps:
                firebase_admin.initialize_app()
            self.bucket = storage.bucket()
            self.use_firebase = True
        except Exception as e:
            logger.warning(f"Firebase Admin SDK not initialized: {e}. Fallback to local disk storage.")
            self.use_firebase = False
            self.bucket = None

    async def upload_file(self, file_bytes: bytes, destination_path: str, mime_type: str) -> str:
        """
        Uploads raw file bytes to Firebase Storage bucket.
        Returns the bucket path of the uploaded file on success, otherwise raises Exception.
        """
        if self.use_firebase and self.bucket is not None:
            try:
                blob = self.bucket.blob(destination_path)
                blob.upload_from_string(file_bytes, content_type=mime_type)
                return f"documents/{destination_path}"
            except Exception as e:
                logger.error(f"Firebase Storage Upload failed: {e}")
                raise e
        else:
            # Fallback to local files list simulation for testing or dev mode
            local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/storage"))
            os.makedirs(local_dir, exist_ok=True)
            local_path = os.path.join(local_dir, destination_path.replace("/", "_"))
            with open(local_path, "wb") as f:
                f.write(file_bytes)
            return f"documents/{destination_path}"

    async def delete_file(self, file_path: str) -> bool:
        """
        Deletes a file from the Firebase Storage bucket.
        """
        relative_path = file_path
        if file_path.startswith("documents/"):
            relative_path = file_path.replace("documents/", "", 1)
            
        if self.use_firebase and self.bucket is not None:
            try:
                blob = self.bucket.blob(relative_path)
                if blob.exists():
                    blob.delete()
                    return True
                return False
            except Exception as e:
                logger.error(f"Firebase Storage Delete failed: {e}")
                return False
        else:
            local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scratch/storage"))
            local_path = os.path.join(local_dir, relative_path.replace("/", "_"))
            if os.path.exists(local_path):
                os.remove(local_path)
                return True
            return False
            
storage_service = StorageService()
