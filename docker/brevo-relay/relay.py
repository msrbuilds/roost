"""Internal authenticated SMTP adapter for Brevo's transactional email API.

No published port is required. Both GoTrue and the application can use this
transport when the operator has a Brevo API key rather than an SMTP credential.
"""
import asyncio
import email.policy
import hmac
import json
import os
import smtplib
import urllib.error
import urllib.request
from email.parser import BytesParser
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword

API_KEY = os.environ['BREVO_API_KEY']
USERNAME = os.environ['SMTP_RELAY_USERNAME']
PASSWORD = os.environ['SMTP_RELAY_PASSWORD']
SENDER = os.environ['SMTP_FROM_EMAIL']
NAME = os.environ.get('SMTP_FROM_NAME', 'Roost')

def authenticate(server, session, envelope, mechanism, auth_data):
    valid = isinstance(auth_data, LoginPassword) and hmac.compare_digest(auth_data.login, USERNAME.encode()) and hmac.compare_digest(auth_data.password, PASSWORD.encode())
    return AuthResult(success=valid, handled=False)

def deliver(envelope):
    message = BytesParser(policy=email.policy.default).parsebytes(envelope.content)
    payload = {'sender': {'email': SENDER, 'name': NAME},
               'to': [{'email': recipient} for recipient in envelope.rcpt_tos],
               'subject': str(message.get('Subject', 'Roost notification'))}
    html = message.get_body(preferencelist=('html',))
    text = message.get_body(preferencelist=('plain',))
    if html:
        payload['htmlContent'] = html.get_content()
    if text:
        payload['textContent'] = text.get_content()
    if not html and not text:
        raise ValueError('Email has no supported body')
    request = urllib.request.Request('https://api.brevo.com/v3/smtp/email',
        data=json.dumps(payload).encode(), headers={'api-key': API_KEY, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 201:
            raise ValueError('Brevo did not accept the message')
    # Optional copy to a private staging mailbox for automated link verification.
    if os.environ.get('SMTP_CAPTURE_HOST'):
        with smtplib.SMTP(os.environ['SMTP_CAPTURE_HOST'], 1025, timeout=10) as smtp:
            smtp.sendmail(envelope.mail_from, envelope.rcpt_tos, envelope.content)

class Handler:
    async def handle_DATA(self, server, session, envelope):
        try:
            await asyncio.to_thread(deliver, envelope)
            print('Transactional email accepted by Brevo', flush=True)
            return '250 Message accepted'
        except (urllib.error.URLError, ValueError, smtplib.SMTPException, TimeoutError) as error:
            print(f'Transactional delivery failed: {type(error).__name__}', flush=True)
            return '451 Transactional delivery temporarily unavailable'

async def main():
    controller = Controller(Handler(), hostname='0.0.0.0', port=1025,
        authenticator=authenticate, auth_required=True, auth_require_tls=False,
        data_size_limit=5 * 1024 * 1024)
    controller.start()
    print('Internal Brevo SMTP adapter ready', flush=True)
    try:
        await asyncio.Event().wait()
    finally:
        controller.stop()

asyncio.run(main())
