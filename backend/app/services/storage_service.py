import httpx
from app.config import settings

class StorageService:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        # We use the service role key to bypass client restrictions and manage files securely
        self.headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY
        }
        self.bucket = "documents"

    async def upload_file(self, file_bytes: bytes, destination_path: str, mime_type: str) -> str:
        """
        Uploads raw file bytes to Supabase Storage bucket.
        Returns the public/storage path of the uploaded file on success, otherwise raises Exception.
        """
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{destination_path}"
        
        # Add mime-type to headers
        headers = {**self.headers, "Content-Type": mime_type}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, content=file_bytes, headers=headers)
            
            if response.status_code == 200:
                # File uploaded successfully, return reference path
                return f"{self.bucket}/{destination_path}"
            else:
                raise Exception(
                    f"Supabase Storage Upload failed ({response.status_code}): {response.text}"
                )

    async def delete_file(self, file_path: str) -> bool:
        """
        Deletes a file from the Supabase Storage bucket.
        file_path format: 'documents/user_id/filename.ext'
        """
        # Strip bucket name from the url if it is passed in the file_path
        relative_path = file_path
        if file_path.startswith(f"{self.bucket}/"):
            relative_path = file_path.replace(f"{self.bucket}/", "", 1)
            
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{relative_path}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=self.headers)
            return response.status_code == 200
            
storage_service = StorageService()
