from app.config import settings


async def send_verification_email(email: str, token: str) -> bool:
    import aiosmtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email - Roflochatik"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = email

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px;">
                <h1 style="color: white; margin: 0;">Roflochatik</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333;">Verify your email address</h2>
                <p style="color: #666; font-size: 16px;">
                    Thank you for registering! Please verify your email address by clicking the button below:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Verify Email
                    </a>
                </div>
                <p style="color: #999; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <span style="color: #667eea;">{verification_url}</span>
                </p>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                    If you didn't create an account, please ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    text_content = f"""
    Verify your email - Roflochatik

    Thank you for registering! Please verify your email address by visiting:
    {verification_url}

    If you didn't create an account, please ignore this email.
    """

    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    msg.attach(part1)
    msg.attach(part2)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False