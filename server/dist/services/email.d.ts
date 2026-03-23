interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
declare class EmailService {
    private transporter;
    private fromEmail;
    private fromName;
    constructor();
    private initializeTransporter;
    sendEmail(options: SendEmailOptions): Promise<boolean>;
    sendWelcomeEmail(params: {
        email: string;
        name: string;
        productName: string;
        variantName?: string;
        resetPasswordUrl: string;
    }): Promise<boolean>;
    sendSubscriptionCancelledEmail(params: {
        email: string;
        name: string;
        productName: string;
        gracePeriodEnds: Date;
    }): Promise<boolean>;
    sendSubscriptionReactivatedEmail(params: {
        email: string;
        name: string;
        productName: string;
    }): Promise<boolean>;
    sendPasswordResetEmail(params: {
        email: string;
        name: string;
        resetUrl: string;
    }): Promise<boolean>;
    sendNotificationEmail(params: {
        to: string;
        userName: string;
        notificationType: string;
        title: string;
        message?: string;
        link?: string;
    }): Promise<boolean>;
    sendActivationStatusEmail(params: {
        email: string;
        name: string;
        productName: string;
        status: 'pending' | 'in_progress' | 'completed' | 'rejected';
        websiteUrl: string;
        adminNotes?: string;
    }): Promise<boolean>;
    private getNotificationTypeStyles;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.d.ts.map