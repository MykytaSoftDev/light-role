import { PaymentMethodDetails as PaddlePaymentMethodDetails } from "@paddle/paddle-node-sdk";
import { AppleIcon, BanknoteIcon, CreditCard, SmartphoneIcon, Wallet } from "lucide-react";

const PaymentMethodLabels: Record<PaddlePaymentMethodDetails["type"], string> = {
    card: "Card",
    alipay: "Alipay",
    wire_transfer: "Wire Transfer",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    paypal: "PayPal",
    ideal: "iDEAL",
    bancontact: "Bancontact",
    offline: "Offline",
    unknown: "Unknown",
    korea_local: "Korea Local",
    blik: "Blik",
    kakao_pay: "Kakao Pay",
    south_korea_local_card: "South Korea Local Card",
    mb_way: "Mb Way",
    naver_pay: "Naver Pay",
    payco: "Payco",
    pix: "Pix",
    samsung_pay: "Samsung Pay",
    upi: "Upi",
    wechat_pay: "Wechat Pay"
};

const PaymentMethodIcons: Partial<Record<PaddlePaymentMethodDetails["type"], React.ReactNode>> = {
  card: <CreditCard size={18} className="text-muted-foreground" />,
  alipay: <Wallet size={18} className="text-muted-foreground" />,
  wire_transfer: <BanknoteIcon size={18} className="text-muted-foreground" />,
  apple_pay: <AppleIcon size={18} className="text-muted-foreground" />,
  google_pay: <SmartphoneIcon size={18} className="text-muted-foreground" />,
  paypal: <Wallet size={18} className="text-muted-foreground" />,
  ideal: <BanknoteIcon size={18} className="text-muted-foreground" />,
  bancontact: <BanknoteIcon size={18} className="text-muted-foreground" />,
  offline: <BanknoteIcon size={18} className="text-muted-foreground" />,
  unknown: <Wallet size={18} className="text-muted-foreground" />,
  korea_local: <BanknoteIcon size={18} className="text-muted-foreground" />,
};

interface Props {
  type: PaddlePaymentMethodDetails["type"];
  card?: PaddlePaymentMethodDetails["card"];
}

export function PaymentMethodDetails({ type, card }: Props) {
  if (type === "card") {
    return (
      <>
        <CreditCard size={18} className="text-muted-foreground" />
        <span className={"text-base leading-4 font-medium"}>**** {card?.last4}</span>
      </>
    );
  } else {
    return (
      <>
        {PaymentMethodIcons[type] || <Wallet size={18} className="text-muted-foreground" />}
        <span className={"text-base leading-4 font-medium"}>
          {PaymentMethodLabels[type] || "-"}
        </span>
      </>
    );
  }
}
