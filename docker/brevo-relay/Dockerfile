FROM python:3.13-alpine
RUN pip install --no-cache-dir aiosmtpd==1.4.6
WORKDIR /app
COPY relay.py .
USER nobody
CMD ["python", "-u", "relay.py"]
