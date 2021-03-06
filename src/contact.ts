import { APIGatewayProxyHandler, APIGatewayEvent, 
  // Context, Callback
 } from 'aws-lambda';
import 'source-map-support/register';
import { verify } from 'hcaptcha';
import * as disposableEmails from "disposable-email-domains"
import { email } from '@hapi/address'
import sendgrid from '@sendgrid/mail';
import { sendMessageDTO } from '@models/dto/sendMessageDTO';
import { MessageUtil, StatusCode } from "@utils/message"

sendgrid.setApiKey(process.env.SENDGRID_API_KEY)

const buildMessage = (messageDTO: sendMessageDTO) => {
return {
    to: process.env.CONTACT_EMAIL,
    from: process.env.CONTACT_EMAIL,
    subject: 'New Website Message',
    text: `new message from: \n${messageDTO.name} \n${messageDTO.email} \n message:\n ${messageDTO.message}`,
    html: `
      <div>
        <div>
          <b>from:</b>
          <p>${messageDTO.name}</p>
          <p>${messageDTO.email}</p>
        </div>
        <div>
          <b>message:</b>
          <p>${messageDTO.message}</p>
        </div>
      </div>
    `,
  }
}

export const sendMessage: APIGatewayProxyHandler = async (
  event: APIGatewayEvent,
  // context: Context,
  // callback: Callback,
): Promise<any> => {
  try {
    const message: sendMessageDTO = JSON.parse(event.body);
    if(!message.name || message.name.length < 3) {
      return MessageUtil.error(StatusCode.notAcceptable, "Missing or invalid name.")
    }
    if(!email.isValid(message.email)) {
      return MessageUtil.error(StatusCode.notAcceptable, "Invalid email.")
    } else {
      const domain = message.email.split("@")[1];
      if(disposableEmails.includes(domain)) {
        return MessageUtil.error(StatusCode.notAcceptable, "Sorry that looks like a disposable email provider.")
      }
    }
    if(!message.message || message.message.length < 20) {
      return MessageUtil.error(StatusCode.notAcceptable, "Message must be atleast 20 characters :).")
    }
    if(!message.captchaToken || message.captchaToken.length < 20) {
      return MessageUtil.error(StatusCode.notAcceptable, "Captch token is required :).")
    }
    try {
      const data = await verify(process.env.HCAPTCHA_SECRET, message.captchaToken)
      if(!data.success) throw new Error(data['error-codes'][0])
    } catch (error) {
      console.log("Token validation error", error)
      return MessageUtil.error(StatusCode.notAcceptable, "Captch token error.")
    }
    const payload = buildMessage(message);
    if (process.env.NODE_ENV === "production") {
      await sendgrid.send(payload)
    } else {
      console.log("[DEV MODE] Skip sending this email:", payload)
    }
    return MessageUtil.success({
      message: "sending!"
    })
  } catch (error) {
    console.log("Error senidng message", error)
    return MessageUtil.error(StatusCode.internalServerError, error.message)
  }
};
