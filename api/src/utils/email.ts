import nodemailer from "nodemailer";

type InlineAttachment = {
  filename: string;
  path: string;
  cid: string;
};

export const sendEmail = async ({
  to,
  subject,
  body,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: InlineAttachment[];
}) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: body,
    html,
    attachments,
  });
};
