import { type Mailer } from '@sarmata/services/system';
import nodemailer from 'nodemailer';

/**
 * SMTP adapter of the `Mailer` port. One transport per message: digests are rare, so a pool would
 * only keep idle connections open.
 */
export function createSmtpMailer(): Mailer {
  return {
    async send(message, smtp) {
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        ...(smtp.user === null ? {} : { auth: { user: smtp.user, pass: smtp.password ?? '' } }),
      });
      try {
        await transport.sendMail({
          from: { name: smtp.fromName, address: smtp.from },
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } finally {
        transport.close();
      }
    },
  };
}
