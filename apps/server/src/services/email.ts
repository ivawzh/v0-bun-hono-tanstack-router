interface InvitationEmailData {
  inviterName: string;
  projectName: string;
  invitationUrl: string;
  email: string;
}

export class EmailService {
  static async sendInvitation(data: InvitationEmailData): Promise<void> {
    // For now, just log the invitation email
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    
    const emailContent = `
Hi!

${data.inviterName} has invited you to join the "${data.projectName}" project on Solo Unicorn.

Click the link below to accept the invitation:
${data.invitationUrl}

This invitation will expire in 7 days.

Best regards,
Solo Unicorn Team
    `;

    console.log(`[Email Service] Would send invitation email to: ${data.email}`);
    console.log(`[Email Service] Email content:\n${emailContent}`);
    
    // In the future, add actual email sending logic here
    // Example:
    // await emailProvider.send({
    //   to: data.email,
    //   subject: `Invitation to join ${data.projectName} on Solo Unicorn`,
    //   text: emailContent
    // });
  }
}