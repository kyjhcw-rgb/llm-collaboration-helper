FROM python:3.12.8
WORKDIR /app

COPY ai/requirements.txt . 
RUN pip install --no-cache-dir -r requirements.txt

COPY ai/ .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
