class AUTH {
  private root = "/auth";

  LOGIN = `${this.root}/login`;
  REGISTRATION = `${this.root}/register`;
  FORGOT_PASSWORD = `${this.root}/forgot-password`;
  RESET_PASSWORD = `${this.root}/reset-password`;
  CALLBACK = `${this.root}/callback`;
}

class DASHBOARD {
  private root = "/dashboard";

  HOME = this.root;
  COVER_LETTERS = `${this.root}/cover-letters`;
  JOBS = `${this.root}/jobs`;
  PAYMENTS = `${this.root}/payments`;
  RESUMES = `${this.root}/resumes`;
  TAILOR_RESUME = `${this.RESUMES}/tailor`;
  GENERATE_COVER_LETTERS = `${this.COVER_LETTERS}/generate`;
  PROFILE = `${this.root}/profile`;
  SETTINGS = `${this.root}/settings`;
  ACCOUNT = `${this.SETTINGS}/account`;
  BILLING = `${this.SETTINGS}/billing`;
  NOTIFICATIONS = `${this.SETTINGS}/notifications`;
  SUBSCRIPTIONS = `${this.root}/subscriptions`;
  CHECKOUT = `${this.root}/checkout`;
  CHECKOUT_SUCCESS = `${this.CHECKOUT}/success`;
  CHECKOUT_UPDATE = `${this.CHECKOUT}/update`;
  ADMIN = `${this.root}/admin`;
  NOT_FOUND = `${this.root}/404`;
}

class LANDING {
  private root = "https://lightrole.com";

  TERMS = `${this.root}/terms-and-conditions`;
  POLICY = `${this.root}/policy`;
  PRICING = `${this.root}/pricing`;
}

export const DASHBOARD_PAGES = new DASHBOARD();
export const AUTH_PAGES = new AUTH();
export const LANDING_PAGES = new LANDING();
