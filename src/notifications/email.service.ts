import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendEmail(to: string, subject: string, _content: string): void {
    this.logger.log(`Sending email to ${to} with subject "${subject}"`);
    // TODO: Implement actual email sending logic (e.g., using nodemailer or an external provider)
  }
}
