package com.rebornsense.printbridge.payment.adyen

import com.adyen.ipp.api.authentication.MerchantAuthenticationService

class RebornMerchantAuthenticationService : MerchantAuthenticationService() {
    override val authenticationProvider = TapToPayAuthenticationProvider()
}
