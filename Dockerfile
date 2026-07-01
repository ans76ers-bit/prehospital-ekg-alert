FROM python:3.12-slim

WORKDIR /app
COPY . /app

ENV PORT=5173
EXPOSE 5173

CMD ["python", "server.py"]
