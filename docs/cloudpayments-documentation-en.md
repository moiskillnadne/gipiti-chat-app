[Example](#)

## Summary of changes

Version 3.1.2 from 11.05.2021

This section reflects the changes in the document made from 01/01/2021.

| Version number | Section | Description | Date of change |
| --- | --- | --- | --- |
| 3.1.1 | API [Payout by a Cryptogram](#payout-by-a-cryptogram) | Added the Payer parameter to the method for payment by cryptogram of payment data | 2021-01-18 |
| 3.1.2 | API [Payout by a Cryptogram](#interface-basics) | Including limits to the test terminals | 2021-05-11 |

## General

## Terms and Definitions

- **System** — CloudPayments’ payment gateway.
- **Merchant** — CloudPayments’ client who works with the System.
- **API** — application program interface for interacting with the system, located at https://api.cloudpayments.ru
- **Back Office** — merchant's back office in the system, located at https://merchant.cloudpayments.ru
- **Card** — a bank card of Visa, MasterCard or MIR systems.
- **Acquirer** — a settlement bank.
- **Issuer** — a bank that issued a card.
- **Cardholder** — an owner of a card issued by a bank.
- **Widget** — payment form, provided by the system to enter card data by a holder and perform a further authorization.
- **3-D Secure** — protocol to verify a holder by the issuer.

## Transaction Types

The system involves two types of operations: payment and refund. In the first case, money is transferred from holder's account to the merchant, in the second - vice versa. A merchant performs a refund if a buyer wants to return goods, and it is always associated with a payment transaction, which amount returns to a holder. It is possible to refund a whole payment amount or it's part only. Money usually comes back to a holder’s card the same day, but sometimes (it depends on an issuer) it can take up to 3 days. The payment operation, unlike the refund, can be cancelled. Payment can be canceled by a merchant if the payment has been made with an error: incorrect amount, technical failure on the merchant's side, etc. There is a limitation - operation can be cancelled only if a merchant using the two-stage payment scheme. Money at the same time will be available on the card almost immediately.

## Payment Schemes

There are two options to make a payment transaction: *single message system* (SMS) and *dual message system* (DMS).

**Single message** payment is made by a single command, depending on the authorization results money is transferred to a merchant.

**Dual message** payment uses 2 commands: one is used for authorization and another — for a withdraw. After a successful authorization, transaction amount is going to be locked on a cardholder’s account and become unusable for other payments. Then merchant has up to 7 days (depending on a card type) to confirm a transaction to make a withdraw. If a transaction hasn't been confirmed during this time interval, it becomes cancelled automatically. It is possible to confirm full amount or it's part only.

As a rule, the dual message scheme is used to obtain a deposit from a payer, for example, in rental companies or hotels.

Depending on a configuration, the system can automatically confirm dual message payments within a specified number of days.

## Payment Methods

A payment can be made using following methods:

- Via payment form — [widget](#payment-widget). Add a script that opens a secure payment form (iframe) to enter card data.
- Via [API](#api) by a card’s cryptogram. Add a [checkout](#checkout-script) to your web site which collects card data from any web site’s form, encrypts and creates a cryptogram for a secured transmission through an interserver interaction.
- Via [Apple Pay](#apple-pay) and [Google Pay](#google-pay) on Web and in Mobile.
- Via SDK for mobile applications. Integrate our mobile SDK's into your application for [iOS](#sdk-for-ios) or [Android](#sdk-for-android) and accept card payments from phones or tablets of your buyers.
- Via [API](#api) by a card’s token (recurring). Once the first payment via a widget or by cryptogram is made/authorized, the system assigns an identifier to card data. Such ID is a token which can be safely stored and used for non-acceptance payments (pay per click). The token is returned in a [Pay](#pay) notification and in a system reply to a API request.
- Using a configured plan of periodic payments (recurrent). Once the first payment is done/authorized, the system assigns a token to card data, which is then used to create a subscription plan for recurrent payments. A payment is made automatically by the system, without any payer’s confirmation, according to a customized time period which can be once a day (once some days), once a week (once some weeks) or once a month (once some months). If a next payment attempt fails, the system sends a notification and reattempts in a day. After 3 unsuccessful attempts the system cancels a subscription. During the plan creation, it is possible to specify maximum number of periods, for example, 12 months with a monthly payment, then a subscription will be automatically completed.

## 3-D Secure

3-D Secure is a common name of Verified By Visa and MasterCard Secure Code programs from Visa and MasterCard's respectively. In general, such program shall authenticate a cardholder (that is to protect against an unauthorized card usage) by an issuer before a payment. Actually, it looks as follows: a cardholder specifies card data. Then the issuer’s web site opens, where a cardholder has to enter a password or a secret code (usually, the code is sent in a SMS message). If the code is correct, a payment will be successful. Otherwise, it will be rejected.  
![3ds-demo](https://developers.cloudpayments.ru/en/images/3ds-demo.png)

During the payment process, 3-D Secure appears not on all cards, but only on those, Issuers supporting this technology. Certainly, payments without 3-D Secure are a less secure option.

## Payment Widget

Payment widget is a pop-up form to enter card data and payer’s email address. The widget automatically defines a payment system type: Visa, MasterCard, Maestro or MIR, and an emitting bank of a card and corresponding logos. The form is optimized for use in any browsers and mobile devices. There is an iframe opens within a widget which guarantees a security of card data sending and does not require a certification for merchant's usage.

<iframe src="https://developers.cloudpayments.ru/en/pages/test/index.html" width="96%" height="1000px" align="baseline" frameborder="1"></iframe>

## Widget Installation

To install a widget, you need to add a script on a web site to the **head** section:

```
<script src="https://widget.cloudpayments.ru/bundles/cloudpayments"></script>
```

Define a function for **charge** or **auth** methods calling for payment form to display:

```
this.pay = function () {
    var widget = new cp.CloudPayments();
    widget.pay('auth', // or 'charge'
        { //options
            publicId: 'test_api_00000000000000000000001',  //id of site (from back office)
            description: 'Payment example (no real withdrawal)', // purpose/justification/description
            amount: 10,
            currency: 'RUB',
            accountId: 'user@example.com', //customer's/user's/payer's ID (optional)
            invoiceId: '1234567', // order number  (optional)
            skin: "mini", // disign widget (optional)
            data: {
                myProp: 'myProp value' //arbitrary set of parameters
            }
        },
        {
            onSuccess: function (options) { // success
                //action upon successful payment
            },
            onFail: function (reason, options) { // fail
                //action upon unsuccessful payment
            },
            onComplete: function (paymentResult, options) { //It is called as soon as the widget receives a response from api.cloudpayments with the result of the transaction.
                //e.x. calling your Facebook Pixel analytics
            }         
        }
    )
};
```

Call the function when some event is emitted, for example click on the «Pay» button:

```
$('#checkout').click(pay);
```

The demonstration of the widget is presented in our [demo store](https://show.cloudpayments.ru/). For testing you can use both [test card data](#testing) and real ones. Money withdrawal will not occur.

## Parameters

A call of charge or auth function defines a payment scheme:

- **charge** for single,
- **auth** — for dual.

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| publicId | String | Required | A web site identifier; located in Back Office |
| description | String | Required | Description of a payment purpose in any format |
| amount | Float | Required | Payment amount |
| currency | String | Required | Currency: RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| accountId | String | Required for creation of subscription | Payer's ID (endpoint customer) |
| invoiceId | String | Optional | Order or Invoice number |
| email | String | Optional | E-mail of that user |
| requireEmail | bool | Optional | Require user's email address to be specified in the widget |
| data | Json | Optional | Any other data which relates to a transaction, including instructions for a subscription creation or generation of an online [receipt](#online-receipt-format-for-payment-methods). We reserved names of following parameters and display their contents in a transaction registry which are available in the Back Office: `name`, `firstName`, `middleName`, `lastName`, `nick`, `phone`, `address`, `comment`, `birthDate`. |
| skin | String | Optional | Widget design option. Possible values: "classic", "modern", "mini". The classic is default |
| retryPayment | bool | Optional | Display the "Repeat payment" button if the payment is unsuccessful. (true is default) |

You can define the form behaviour for successful or unsuccessful payment using the following parameters:

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| onSuccess | Function or String | Optional | Either a function or a web site's page is specified. If a function is specified, it will be called after successful payment completion. If a page is specified, a payer will be directed to a specified page |
| onFail | Function or String | Optional | Either a function or a web site's page is specified. If a function is specified, it will be called after unsuccessful payment completion. If a page is specified, a payer will be directed to a specified page. |
| onComplete | Function | Optional | A function is specified that will be called as soon as the widget receives a response with the result of the transaction. You cannot make redirects in this method. |

## Widget Localization

The widget is in Russian by default. You need to add the **language** parameter in the widget to localize it:

```
var widget = new cp.CloudPayments({language: "en-US"});
```

List of supported languages:

| languages | Timezone | Value |
| --- | --- | --- |
| Russian | MSK | ru-RU |
| English | CET | en-US |
| German | CET | de-DE |
| Latvian | CET | lv |
| Azerbaijani | AZT | az |
| Russian | ALMT | kk |
| Kazakh | ALMT | kk-KZ |
| Ukrainian | EET | uk |
| Polish | CET | pl |
| Portuguese | CET | pt |
| Czech | CET | cs-CZ |
| Vietnamese | ICT | vi-VN |
| Turkish | TRT | tr-TR |
| Spanish | CET | es-ES |
| Italian | CET | it |

## Recurrent Payments (Subscription)

After successful payment the widget can automatically create a subscription to recurrent payments. For that you have to add the next parameters:

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Interval | String | Required | An interval. Possible values are: Day, Week, Month. |
| Period | Int | Required | A period. Use in combination with an interval, 1 Month means once a month, and 2 Week means biweekly. |
| MaxPeriods | Int | Optional | Maximum number of payments in a subscription. No limitation by default |
| Amount | Numeric | Optional | A regular payment amount. Matches with the first payment amount by default. |
| StartDate | DateTime | Optional | Date and time of the first regular payment. By default a startup will occur in a specified interval and the period, for example, in a month. |
| CustomerReceipt | String | Optional | Data for generation of an online [receipt](#online-receipt-format-for-payment-methods). |

It is necessary to add the parameters for starting regular payments to the **data.cloudPayments.recurrent** as shown below:

```
this.pay = function () {
    var widget = new cp.CloudPayments();
    var receipt = {
            Items: [//positions of goods
                 {
                    label: 'Product #2', //goods name
                    price: 300.00, //price (per 1 item)
                    quantity: 3.00, //quantity
                    amount: 900.00, // line amount (incl. the discounts)
                    vat: 20, // vat rate
                    method: 0, // tag-1214 sign of a calculation method
                    object: 0, // tag-1212 sign of  the subject of calculation - sign of items, goods, services, payment, payout or other subject of calculation
                }
            ],
            taxationSystem: 0, 
            email: 'user@example.com', //e-mail of customer, if you need to send an online-receipt
            phone: '', //phone of customer, if you need to send an online-receipt in SMS as link
            isBso: false, // receipt hasn't a strict reporting form
            amounts:
            {
                electronic: 900.00, // The amount of payment by electronic money (2 decimal places)
                advancePayment: 0.00, // Amount from prepayment (offset of advance payment) (2 decimal places)
                credit: 0.00, // Amount of prepayment (on credit) (2 decimal places)
                provision: 0.00 // The amount of payment by the reciprocal grant (certificates, other material values) (2 decimal places) 
            }
        };

    var data = {};
    data.cloudPayments = {
        CustomerReceipt: receipt, //receipt for the first payment
        recurrent: {
         interval: 'Month',
         period: 1, 
         customerReceipt: receipt //receipt for recurring payments
         }
         }; //create a monthly subscription

    widget.charge({ // options
        publicId: 'test_api_00000000000000000000001', //id of site (from back office)
        description: 'Subscription on monthly access to https://example.com', //justification
        amount: 1000, //subscription amount
        currency: 'RUB', 
        invoiceId: '1234567', //order or invoice number (optional) 
        accountId: 'user@example.com', //customer/user's ID  (required for subscription)
        data: data
    },
    function (options) { // success
               //action upon successful payment
    },
    function (reason, options) { // fail
                //action upon unsuccessful payment
    });
};
```

For more examples of accepting payments using the widget see [Integration Scenarios](#integration-scenarios).

For cancelling of recurrent payments use BackOffice features, API, or provide a customer with a link to the system web site [https://my.cloudpayments.ru/unsubscribe](https://my.cloudpayments.ru/unsubscribe) where he or she can find and cancel subscriptions by him or herself.

## Widget Mobile

A script automatically defines user device and starts the most suitable widget option: customary mode or optimized for mobile devices. For customers's convinience the mobile version occupies a whole screen and prompts to make a payment using a card, or Apple Pay, or Google Pay.

- The widget offers Apple Pay on iPhone and iPad in the Safari browser;
- A customer confirms payment using Face ID or Touch ID;
- A payment is instantly and successfully completed;
- The widget offers Google Pay on Android devices in the Chrome browser;
- Depending on device features customer confirms payment by biometry, password, or 3-d Secure;
- Payment is instantly and successfully completed.

You can make payments in the widget via Apple Pay and Google Pay if following conditions are met:

1. A web site works through **HTTPS** and supports **TLS version 1.2**.
2. A web site provides no **"mixed content"**, when a part of resources is loaded through **HTTPS**, and another part is through **HTTP**.
3. [Simplified (only for websites)](#simplified-integration-web-only) or [classic](#classic-integration) integration of Apple Pay functions.
4. The customer opened the payment page on the site in a browser that supports Apple or Google Pay. For Apple Pay, this is Apple Safari, for Google Pay - Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge, Opera, or UCWeb UC. Other browsers do not support Apple or Google Pay payments.

## Checkout Script

Checkout is a script which may be built into your website. It collects card data from a specified form needed for cryptogram generation in order to make payment via API available.

The cryptogram is generated according to the RSA algorithm with a key length of 2048 bit and meets the standard on the card data protection. You do not receive card data following the next requirements, but your server can still influence card data security.

## Requirements

### Form requirements:

- It must be loaded through HTTPS connection with a valid SSL certificate;
- Fields must not contain the “name” attribute. It prevents card data from passing to a server when sending a form;
- A card number field must be filled in the range from 16 to 19 digits.

### Cryptogram requirements:

- It must be generated only by the original checkout script loaded from the system addresses.
- It is prohibited to store a cryptogram after payment and reuse it.

### PCI DSS security requirements:

In terms of PCI DSS a such way is classified as follows: “E-commerce merchants who outsource all payment processing to PCI DSS validated third parties, and who have a website(s) that doesn’t directly receive cardholder data but that can impact the security of the payment transaction. No electronic storage, processing, or transmission of any cardholder data on the merchant’s systems or premises.” That means payment data is processed by a third party, but a web site influences a security of card data.

You have to fill the [SAQ-EP](https://www.pcisecuritystandards.org/documents/SAQ_A-EP_v3.docx) self-estimation sheet and quarterly pass the ASV test to meet the standard requirements.

For more information on compliance with PCI requirements see [PCI DSS](#pci-dss).

## Installation

To create a cryptogram, you need to add **checkout** script on a page with a payment form:

```
<script src="https://widget.cloudpayments.ru/bundles/checkout"></script>
```

At the beginning create a card data entering form:

```
<form id="paymentFormSample" autocomplete="off">
    <input type="text" data-cp="cardNumber">
    <input type="text" data-cp="expDateMonth">
    <input type="text" data-cp="expDateYear">
    <input type="text" data-cp="cvv">
    <input type="text" data-cp="name">
    <button type="submit">Pay 100 Rubles</button>
</form>
```

Input fields must be marked with the following attributes:

- **data-cp="cardNumber"** — a field with a card number;
- **data-cp="expDateMonth"** — a field with an expiration month;
- **data-cp="expDateYear"** — a field with an expiration year;
- **data-cp="cvv"** — a field with a CVV code;
- **data-cp="name"** — a field with the last name and the first name of a cardholder.

Once done add a script to create a cryptogram:

```
this.createCryptogram = function () {
    var result = checkout.createCryptogramPacket();

    if (result.success) {
        // if cryptogram generated successfully
        alert(result.packet);
    }
    else {
        // if issues found, object  \`result.messages\` returns: 
        // { name: "Name field contains too much letters", cardNumber: "Wrong PAN" }
        // where \`name\`, \`cardNumber\` matches to attribute values \`<input ... data-cp="cardNumber">\`
       for (var msgName in result.messages) {
           alert(result.messages[msgName]);
       }
    }
};

$(function () {
    /* Creation of checkout */
    checkout = new cp.Checkout(
    // public id 
    "test_api_00000000000000000000001",
    // tag, containing card data fields
    document.getElementById("paymentFormSample"));
});
```

Then send the cryptogram and a name of a card holder to a server and call a payment method via [API](#payment-by-a-cryptogram).

You may learn how [Checkout](#checkout-script) script works in our [demo store](https://show.cloudpayments.ru/) . You can use both [test card data](#testing) and real one for testing. Money withdrawal will not occur.

### When developing your own form, pay attention to the following points:

- A card number length is from 16 to 19 digits;
- Checkout script is not compatible with out-of-date and unsafe browsers which do not support TLS encryption protocols version 1.1 or higher. For example, Internet Explorer 7;
- 3DS window can be displayed either in a new window or in a frame over a page. A window size should be at least 500×500 pixels.

## Recurrent Payments

Recurrent payments that are also known as payments by subscription provide an ability to perform regular money withdrawal from a payer's bank card without re-entering of card details and without participation of a payer for initiation the next payment.

Recurrent payments always begin with the first (setup) payment which requires a payer's card details. It is necessarily needed to familiarize a card holder with the schedule and obtain his consent of direct withdrawal for later regular payments.

There is a widespread belief that the task of recurrent payments is to set an amount to be withdrawn from a client’s card each month. Choice of a regular payment system is based only on cost of provided services. Actually the situation is more complicated because quality of service requires far more functions and features and therefore the procedure for launching and processing recurrent payments in CloudPayments is as simple and flexible as possible while in other systems it is more complicated and limited.

## Starting and Stopping Subscriptions

You can start recurrent payments at any time once a setup payment is effected: at the same time, in a week, or in a month. There is the only one restriction: the interval between regular payments, as well as between the starting and the first regular payment, can not exceed one year.

*Example:* A customer pays the first month of services provision for the first time and consents to a monthly withdrawal from his card starting from the second month. Regular payments can be scheduled through [API](#creation-of-subscriptions-on-recurrent-payments) or [payment widget](#payment-widget).

If a customer refuses further payments, you can cancel a subscription at any time:

- Via [Back Office](https://merchant.cloudpayments.ru/login);
- Via [API](#subscription-on-recurrent-payments-cancellation).

Also a customer can independently find and cancel his or her regular payments at [CloudPayments site](https://my.cloudpayments.ru/en/unsubscribe).

## Customizing Payment Schedule

### Withdrawal Period and Interval Selection

The system can effect regular payments every 2 weeks, 1 time per month, every 3 months, and so on: you can specify any period.

### Withdrawal Starting Date Selection

Recurrent payments can be started immediately when you create a subscription, or with a delay.

*Example:* A customer subscribes to your service in the middle of a month, then you create a plan for monthly recurring payments starting from the next month on the 15th each month.

### Payment Limit

You can specify maximum number of payments in a subscription, or you can create a plan without any limits. In the first case, recurrent payments will be automatically stopped once all the payments in the schedule are done.

*Example:* A customer purchases goods worth 600$ in installments for a year. He or she pays 50$ as a setup payment and subscribes to a recurrent payment plan of 50$ monthly, but no more than 11 withdrawals.

### Subscription Plan Freezing

Subscription to regular payments can be suspended at any time from your personal account or via [API](#recurrent-payments-subscription-change).

*Example:* A customer asks to suspend services provision for a couple of months, then you shift a date of the next payment for the corresponding period.

## Payment Amount Change

### Setup Payment Amount

Amount of the first (setup) payment can be arbitrary and differ from amount of subsequent recurrent payments.

*Example:* A customer signs up in your service, then you ask him or her to make a setup payment for 1 ruble (or 1 of another currency) to check the card. After that you can start recurrent payments for any amount with the consent of a customer.

### Recurrent Payments Amount Change

Amount of recurrent payments can be changed at any time during the term of a plan through [Back Office](https://merchant.cloudpayments.ru/login) or via [API](#recurrent-payments-subscription-change).

*Example:* You grant a discount to a customer for the first two months of using the service, then you can increase subscription amount.

### Automatic error correction

Errors that occur when making recurrent payments can be separated into two categories: recoverable and non-recoverable.

The first category includes errors associated with insufficient funds on a customer's card, errors of temporary technical problems, or unavailability of a card issuing bank. As a rule, these problems are recoverable over time or by the intervention of a cardholder.

Errors that cannot be corrected relate to the second category: card is expired, card is lost, license is revoked from an issuing bank.

The system handles recurrent payment errors and responds differently depending on the category.

### Cardholder Interaction

In case of decline due to insufficient funds on a card, the system informs a holder that the latest payment was failed and that the next attempt to write-off the fund will be the next day, and recommends to top up a card balance.

### Retry

The system repeats withdrawal attempts for several days if subsequent payment fails due to recoverable error.

### Card Data Update

The system offers to fill the form with a new card data to continue recurrent payments. If a customer agrees, the system effects a new setup payment using the details of the received card, adds the payment to the subscription, and continues regular payments using the updated card.

### Payer Notification

An important function of recurring payments is timely informing a cardholder on the next payment date. Customers are used to forget about it, so the impendent withdrawal warning prevents insufficient funds on a card. CloudPayments always reminds customers of the next payment date indicating payment date, payment amount, payment description, and a payee.

## SDK for iOS

The application demonstrates work with CloudPayments SDK for the iOS platform. You can download it from [GitHub](https://github.com/cloudpayments/SDK-iOS). There is also a new version of the SDK, you can try using it. It has successfully passed internal testing and is currently being tested with our pilot merchants. This is a beta version, but in the future it will completely replace the current version of the SDK - [GitHub](https://github.com/cloudpayments/CloudPayments-SDK-iOS).

In this app you will learn how to get a card data, create a cryptogram, do a [3-D Secure authorization](#3-d-secure) and make a payment on iPhone or iPad.

**Terms of use**:

- We strongly recommend you do not send any data for a payment from a mobile device directly to the CloudPayments API. Please store your credentials on your server to access the API, and support a thin client in a mobile application;
- Your server will not require a PCI certification as soon as it receives encrypted card data. Keys for a deencryption are available only in a CloudPayments’ payment gateway (they are not available either in application nor in a library);
- Card data can be entered using your keyboard or by scanning via your camera (for example, via [card.io](https://www.card.io/)). A full number of a card and CVV cannot be stored or logged;
- The Mobile SDK cannot be used for mobile stations (mPos). The only usage is in applications which will be installed on phones and tablets of your buyers;
- According to [AppStore](https://developer.apple.com/app-store/review/guidelines/#purchasing-currencies) rules, a mobile application developer has the right to accept payments using third-party payment systems only for selling non-digital goods, or those digital goods which can be used beyond the application.

## SDK for Android

The application demonstrates work with CloudPayments SDK for the Android platform. You can download it from [Github](https://github.com/cloudpayments/SDK-Android). There is also a new version of the SDK, you can try using it. It has successfully passed internal testing and is currently being tested with our pilot merchants. This is a beta version, but in the future it will completely replace the current version of the SDK - [GitHub](https://github.com/cloudpayments/CloudPayments-SDK-Android).

In this app you will learn how to get a card data, create a cryptogram, do a [3-D Secure authorization](#3-d-secure), and make a payment on Android devices.

**Terms of use**:

- We strongly recommend you do not send any data for a payment from a mobile device directly to the CloudPayments API. Please store your credentials on your server to access the API, and support a thin client in a mobile application;
- Your server will not require a PCI certification as soon as it receives encrypted card data. Keys for deencryption are available only in a CloudPayments’ payment gateway (they are not available either in application nor in a library);
- Card data can be entered using your keyboard or by scanning via your camera (for example, via [card.io](https://www.card.io/)). A full number of a card and CVV cannot be stored or logged;
- The Mobile SDK cannot be used for mobile stations (mPos). The only usage is in applications which will be installed on phones and tablets of your customers;
- According to [Google Play](https://play.google.com/about/monetization-ads/) rules, a mobile application developer has the right to accept payments using third-party payment systems only for selling non-digital goods, or those digital goods which can be used beyond the application.

## API

**API** is an application program interface to interact with Merchant's system.

Interaface works on [api.cloudpayments.ru](https://api.cloudpayments.ru/) and provides functionality for making a payment, canceling a payment, refunding, confirming payments made according to a dual scheme mode, creating and canceling subscriptions for recurrent payments, and sending invoices by email.

## Interface Basics

- Parameters are sent by POST method in a request body in the “key = value” or JSON format.
- An API can accept no more than 150,000 fields in a single request. The timeout for receiving a response from the API is 5 minutes.
- In all requests to the API, if you pass a number with a fractional part to an integer field, then there will be no error, but mathematical rounding will occur.
- The limit on the number of concurrent requests for test terminals is 5. If the number of currently processed any requests on test terminals is more than 5, then for subsequent requests api will return a response with HTTP code 429 (Too many Requests) until at least one request is processed.

Parameters\` transfer format is determined on client side and can be changed in the request header [Content- Type](https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.17) .

- For **«key=value»** parameters Content-Type is *application/x-www-form-urlencoded*;
- For **JSON Content-Type** parameters Content-Type is *application/json*;

The system returns a response in JSON format which includes at least two parameters: **Success** and **Message**:

```
{ "Success": false, "Message": "Invalid Amount value" }
```

## Requests Authentication

For authentication [HTTP Basic Auth](https://en.wikipedia.org/wiki/Basic_access_authentication) is used which is sending a login and a password in a header of HTTP request. **Public ID** serves as a login and **API Secret** serves as a password. Both of these values you can get in the back office.

## API Idempotency

**Idempotency** is an ability of API to produce the same result as the first one without re-processing in case of repeated requests. That means you can send several requests to the system with the same identifier, and only one request will be processed. All the responses will be identical. Thus the protection against network errors is implemented which can lead to creation of duplicate records and actions.

To enable idempotency, it is necessary to send a header with the **X-Request-ID** key containing a unique identifier in API request. Generation of request identifier remains on your side - it can be a guid, a combination of an order number, date and amount, or other values of your choice. Each new request that needs to be processed must include new **X-Request-ID** value. The processed result is stored in the system for 1 hour.

## Test Method

The method to test the interaction with the API.

**Method URL:**  
https://api.cloudpayments.ru/test

**Parameters:**  
none.

**Response example:**  
The method returns a request status.

```
{"Success":true,"Message":"bd6353c3-0ed6-4a65-946f-083664bf8dbd"}
```

## Payment by a Cryptogram

The method to make a payment by a cryptogram generated by the [Checkout](#checkout-script) script, [Apple Pay](#apple-pay), or [Google Pay](#google-pay).

**Method URL's:**  
https://api.cloudpayments.ru/payments/cards/charge — for [single message scheme payment](#payment-schemes)  
https://api.cloudpayments.ru/payments/cards/auth — for [dual message scheme payment](#payment-schemes)

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Amount | Numeric | Required | Payment amount |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| IpAddress | String | Required | Payer's IP address |
| Name | String | Required for all, except of Apple Pay & Google Pay | Cardholder name in latin |
| CardCryptogramPacket | String | Required | Cryptogram |
| paymentUrl | String | Optional | The address of the site from which the checkout script is called |
| InvoiceId | String | Optional | Invoice or order number |
| Description | String | Optional | Payment description |
| CultureName | String | Optional | Language of notifications. Possible values: "ru-RU", "en-US". ([see reference](#localization)) |
| AccountId | String | Optional | Payer's ID (Required for Subscription creation and receiving of correct token) |
| Email | String | Optional | Payer's E-mail to send an online-receipt to |
| Payer | Object | Optional | An additional field where information about the payer is transferred. Use the following parameters: `FirstName`, `LastName`, `MiddleName`, `Birth`, `Street`, `Address`, `City`, `Country`, `Phone`, `Postcode` |
| JsonData | Json | Optional | Any other data that will be associated with transaction including instructions for [Subsctiption creation](#recurrent-payments) or generation of [online-receipt](#online-receipt-format-parameters). We reserved the names of the following parameters and display it in the registry of operations which you can download in Back Office: `name`, `firstName`, `middleName`, `lastName`, `nick`, `phone`, `address`, `comment`, `birthDate`. |

*The server returns JSON response with three components:*

- field **success** — request result;
- field **message** — error description;
- object **model** — extended information.

*Possible response options:*

- Incorrect request: **success** — false  
	**message** — error description
- 3-D Secure authentication is required (not applicable to Apple Pay):  
	**success** — false  
	**model** — authentication information
- Transaction rejected: **success** — false  
	**model** — transaction information and error code
- Transaction accepted: **success** — true  
	**model** — transaction information

**Payment by a cryptogram request example:**

```
{
    "Amount":10,
    "Currency":"RUB",
    "InvoiceId":"1234567",
    "Description":"Order №1234567 in shop example.com",
    "AccountId":"user_x",
    "Name":"CARDHOLDER NAME", // CardCryptogramPacket Required parameter
    "CardCryptogramPacket":"01492500008719030128SMfLeYdKp5dSQVIiO5l6ZCJiPdel4uDjdFTTz1UnXY+3QaZcNOW8lmXg0H670MclS4lI+qLkujKF4pR5Ri+T/E04Ufq3t5ntMUVLuZ998DLm+OVHV7FxIGR7snckpg47A73v7/y88Q5dxxvVZtDVi0qCcJAiZrgKLyLCqypnMfhjsgCEPF6d4OMzkgNQiynZvKysI2q+xc9cL0+CMmQTUPytnxX52k9qLNZ55cnE8kuLvqSK+TOG7Fz03moGcVvbb9XTg1oTDL4pl9rgkG3XvvTJOwol3JDxL1i6x+VpaRxpLJg0Zd9/9xRJOBMGmwAxo8/xyvGuAj85sxLJL6fA==",
    "Payer":
      { 
        "FirstName":"Test",
        "LastName":"Test",
        "MiddleName":"Test",
        "Birth":"1955-02-24",
        "Address":"test address",
        "Street":"Lenins",
        "City":"MO",
        "Country":"RU",
        "Phone":"123",
        "Postcode":"345"
    }
}
```

**Response example:** *incorrect request:*

```
{"Success":false,"Message":"Amount is required"}
```

**Response example:** *3-D Secure authentication is required*

```
{
    "Model": {
        "TransactionId": 504,
        "PaReq": "eJxVUdtugkAQ/RXDe9mLgo0Z1nhpU9PQasWmPhLYAKksuEChfn13uVR9mGTO7MzZM2dg3qSn0Q+X\nRZIJxyAmNkZcBFmYiMgxDt7zw6MxZ+DFkvP1ngeV5AxcXhR+xEdJ6BhpEZnEYLBdfPAzg56JKSKT\nAhqgGpFB7IuSgR+cl5s3NqFTG2NAPYSUy82aETqeWPYUUAdB+ClnwSmrwtz/TbkoC0BtDYKsEqX8\nZfZkDGgAUMkTi8synyFU17V5N2nKCpBuAHRVs610VijCJgmZu17UXTxhFWP34l7evYPlegsHkO6A\n0C85o5hMsI3piNIZHc+IBaitg59qJYzgdrUOQK7/WNy+3FZAeSqV5cMqAwLe5JlQwpny8T8HdFW8\netFuBqUyahV+Hjf27vWCaSx22fe+KY6kXKZfJLK1x22TZkyUS8QiHaUGgDQN6s+H+tOq7O7kf8hd\nt30=",
        "AcsUrl": "https://test.paymentgate.ru/acs/auth/start.do"
    },
    "Success": false,
    "Message": null
}
```

**Response example:** *Transaction rejected. ReasonCode field contains error code (see the [reference](#error-codes)):*

```
{
    "Model": {
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "PaymentAmount": 10.00000,
        "PaymentCurrency": "RUB",
        "PaymentCurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Order №1234567 in shop example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41", //all dates in  UTC format
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Ufa",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardExpDate": "05/19",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Declined",
        "StatusCode": 5,
        "Reason": "InsufficientFunds", // reason of  rejection
        "ReasonCode": 5051, //rejection code
        "CardHolderMessage":"Not enough funds on the card", //message for a payer
        "Name": "CARDHOLDER NAME",
    },
    "Success": false,
    "Message": null
}
```

**Response example:** *transaction accepted:*

```
{
    "Model": {
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Оrder №1234567 in shop example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41", //all the dates in UTC format
        "AuthDate": "\/Date(1401733880523)\/",
        "AuthDateIso":"2014-08-09T11:49:42",
        "ConfirmDate": "\/Date(1401733880523)\/",
        "ConfirmDateIso":"2014-08-09T11:49:42",
        "AuthCode": "123456",
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Ufa",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardExpDate": "05/19",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Completed",
        "StatusCode": 3,
        "Reason": "Approved",
        "ReasonCode": 0,
        "CardHolderMessage":"ayment successfully completed", //message for a payer
        "Name": "CARDHOLDER NAME",
        "Token": "a4e67841-abb0-42de-a364-d1d8f9f4b3c0"
    },
    "Success": true,
    "Message": null
}
```

## 3-D Secure Processing

To complete [3-D Secure authentication](#3-d-secure) , you need to divert a payer to the address specified in the **AcsUrl** parameter of [server's response](#sample-3ds-required) with following parameters:

- **MD** — TransactionId parameter from server response
- **PaReq** — same parameter from server response
- **TermUrl** — the address on your site for returning the payer once authentication successful

### Form example:

```
<form name="downloadForm" action="AcsUrl" method="POST">
    <input type="hidden" name="PaReq" value="eJxVUdtugkAQ/RXDe9mLgo0Z1nhpU9PQasWmPhLYAKksuEChfn13uVR9mGTO7MzZM2dg3qSn0Q+X\nRZIJxyAmNkZcBFmYiMgxDt7zw6MxZ+DFkvP1ngeV5AxcXhR+xEdJ6BhpEZnEYLBdfPAzg56JKSKT\nAhqgGpFB7IuSgR+cl5s3NqFTG2NAPYSUy82aETqeWPYUUAdB+ClnwSmrwtz/TbkoC0BtDYKsEqX8\nZfZkDGgAUMkTi8synyFU17V5N2nKCpBuAHRVs610VijCJgmZu17UXTxhFWP34l7evYPlegsHkO6A\n0C85o5hMsI3piNIZHc+IBaitg59qJYzgdrUOQK7/WNy+3FZAeSqV5cMqAwLe5JlQwpny8T8HdFW8\netFuBqUyahV+Hjf27vWCaSx22fe+KY6kXKZfJLK1x22TZkyUS8QiHaUGgDQN6s+H+tOq7O7kf8hd\nt30=">
    <input type="hidden" name="MD" value="504">
    <input type="hidden" name="TermUrl" value="https://example.com/post3ds?order=1234567">
</form>
<script>
    window.onload = submitForm;
    function submitForm() { downloadForm.submit(); }
</script>
```

To complete the payment, use the following **Post3ds method**.

**Method URL:**  
https://api.cloudpayments.ru/payments/cards/post3ds

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Int | Required | MD parameter value |
| PaRes | String | Required | PaRes value |

The server will return either information about [successful transaction](#sample-approved) or [declined](#sample-declined) in response to correctly created request.

## Payment by a Token (Recurring)

The method to make a payment by a token received either with [payment by cryptogram](#payment-by-a-cryptogram) or via [Pay](#pay) notification.

**Method URL's:**  
https://api.cloudpayments.ru/payments/tokens/charge — for [single message scheme](#payment-schemes) payment. https://api.cloudpayments.ru/payments/tokens/auth — for [dual message scheme](#payment-schemes) payment.

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Amount | Numeric | Required | Amount of payment |
| Currency | String | Required | RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| AccountId | String | Required | Payer's ID |
| Token | String | Required | Card tokens issued by the system. You get it with the first successful payment |
| InvoiceId | String | Optional | Order or invoice number |
| Description | String | Optional | Payment description/purpose |
| IpAddress | String | Optional | Payer's IP address |
| Email | String | Optional | Payer's E-mail to send an online-receipt to |
| JsonData | Json | Optional | Any other data that will be associated with the transaction, including the instructions for [Subsctiption creation](#recurrent-payments) or generation of [online-receipt](#online-receipt-format-parameters). We reserved the names of the following parameters and display it in the registry of operations, which you may download in Back Office: `name`, `firstName`, `middleName`, `lastName`, `nick`, `phone`, `address`, `comment`, `birthDate`. |

*The server returns JSON response with three components:*

- field **success** — request result;
- field **message** — error description;
- object **model** — extended information.

*Possible response options:*

- Incorrect request: **success** — false  
	**message** — error description
- Transaction rejected: **success** — false  
	**model** — transaction information and error code
- Transaction accepted: **success** — true  
	**model** — transaction information

**Payment by token request example:**

```
{
    "Amount":10,
    "Currency":"RUB",
    "InvoiceId":"1234567",
    "Description":"Order №1234567 in shop example.com",
    "AccountId":"user_x",
    "Token":"a4e67841-abb0-42de-a364-d1d8f9f4b3c0"
}
```

**Response example:** *incorrect request*

```
{"Success":false,"Message":"Amount is required"}
```

**Response example:** *transaction rejected. ReasonCode field contains an error code (see the [reference](#error-codes)):*

```
{
    "Model": {
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Order №1234567 in shop example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41", //all the dates in UTC format
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Ufa",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Declined",
        "StatusCode": 5,
        "Reason": "InsufficientFunds", //decline reason
        "ReasonCode": 5051,
        "CardHolderMessage":"Недостаточно средств на карте", //message for a payer
        "Name": "CARDHOLDER NAME",
    },
    "Success": false,
    "Message": null
}
```

**Response example:** *transaction accepted*

```
{
    "Model": {
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Order №1234567 in shop example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41",  //all the dates in UTC format
        "AuthDate": "\/Date(1401733880523)\/",
        "AuthDateIso":"2014-08-09T11:49:42",
        "ConfirmDate": "\/Date(1401733880523)\/",
        "ConfirmDateIso":"2014-08-09T11:49:42",
        "AuthCode": "123456",
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Уфа",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Completed",
        "StatusCode": 3,
        "Reason": "Approved",
        "ReasonCode": 0,
        "CardHolderMessage":"Оплата успешно проведена", //message for a payer
        "Name": "CARDHOLDER NAME",
        "Token": "a4e67841-abb0-42de-a364-d1d8f9f4b3c0"
    },
    "Success": true,
    "Message": null
}
```

## Payment Confirmation

For payments made by [DMS scheme](#payment-schemes) you need to confirm a transaction. Confirmation can be done through Back office or via callig this API method.

**Method URL:**  
https://api.cloudpayments.ru/payments/confirm

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Int | Required | Systems transaction number |
| Amount | Numeric | Required | Amount to confirm in currency of transaction |
| JsonData | Json | Optional | Any other data that will be associated with transaction including the instructions for generation of [online-receipt](#online-receipt-format-parameters) |

**Request example:**

```
{"TransactionId":455,"Amount":65.98}
```

**Response example:**

```
{"Success":true,"Message":null}
```

## Payment Cancellation

Cancellation of payment can be executed through your Back Office or by calling of the API method.

**Method URL:**  
https://api.cloudpayments.ru/payments/void

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Int | Required | Systems transaction number |

**Request example:**

```
{"TransactionId":455}
```

**Response example:**

```
{"Success":true,"Message":null}
```

## Refund

Refund can be executed through your Back Office or by calling of the API method.

**Method URL:**  
https://api.cloudpayments.ru/payments/refund

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Int | Required | Systems transaction number |
| Amount | Numeric | Required | Refund amount in currency of transaction |
| JsonData | Json | Optional | Any other data that will be associated with the transaction, including the instructions for generation of [online-receipt](#online-receipt-format-parameters) |

**Request example:**

```
{"TransactionId":455, "Amount": 100}
```

**Response example:**

```
{
    "Model": {
        "TransactionId": 568
    },
    "Success": true,
    "Message": null
}
```

## Payout by a Cryptogram

Payment by a cryptogram can be executed through calling of this API method.

**Method URL:**  
https://api.cloudpayments.ru/payments/cards/topup

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Name | String | Required | Cardholder Name in Latin |
| CardCryptogramPacket | String | Required | Payment Cryptogram |
| Amount | Numeric | Required | Payment Amount |
| AccountId | String | Required | Payer's ID |
| Email | String | Optional | Payer's E-mail to send an online-receipt to |
| JsonData | Json | Optional | Any other data that will be associated with the transaction. We reserved the names of the following parameters and display it in the registry of operations, which you may download in Back Office: `name`, `firstName`, `middleName`, `lastName`, `nick`, `phone`, `address`, `comment`, `birthDate` |
| Currency | String | Required | Currency |
| InvoiceId | String | Optional | Order or invoice number |
| Description | String | Optional | Payment description/purpose |
| Payer | Object | Optional | Additional field where information about the payer is sent |
| Receiver | Object | Optional | Additional field where information about the recipient is sent |

**Request example:**

```
{
    "Name":"CARDHOLDER NAME",
    "CardCryptogramPacket":"01492500008719030128SMfLeYdKp5dSQVIiO5l6ZCJiPdel4uDjdFTTz1UnXY+3QaZcNOW8lmXg0H670MclS4lI+qLkujKF4pR5Ri+T/E04Ufq3t5ntMUVLuZ998DLm+OVHV7FxIGR7snckpg47A73v7/y88Q5dxxvVZtDVi0qCcJAiZrgKLyLCqypnMfhjsgCEPF6d4OMzkgNQiynZvKysI2q+xc9cL0+CMmQTUPytnxX52k9qLNZ55cnE8kuLvqSK+TOG7Fz03moGcVvbb9XTg1oTDL4pl9rgkG3XvvTJOwol3JDxL1i6x+VpaRxpLJg0Zd9/9xRJOBMGmwAxo8/xyvGuAj85sxLJL6fA==",
    "Amount":1,
    "AccountId":"user@example.com",
    "Currency":"RUB"
    "InvoiceId":"1234567",
    "Payer":
      //The set of fields is the same for the Receiver parameter.
      { 
        "FirstName":"Test",
        "LastName":"Test",
        "MiddleName":"Test",
        "Birth":"1955-02-24",
        "Address":"test address",
        "Street":"Lenins",
        "City":"MO",
        "Country":"RU",
        "Phone":"123",
        "Postcode":"345"
    }
}
```

**Response example:**

```
{
   "Model":{
      "PublicId":"pk_b9b86395c99782f0d16386d83e5d8",
      "TransactionId":100551,
      "Amount":1,
      "Currency":"RUB",
      "PaymentAmount":1,
      "PaymentCurrency":"RUB",
      "AccountId":"user@example.com",
      "Email":null,
      "Description":null,
      "JsonData":null,
      "CreatedDate":"/Date(1517943890884)/",
      "PayoutDate":"/Date(1517950800000)/",
      "PayoutDateIso":"2018-02-07T00:00:00",
      "PayoutAmount":1,
      "CreatedDateIso":"2018-02-06T19:04:50",
      "AuthDate":"/Date(1517943899268)/",
      "AuthDateIso":"2018-02-06T19:04:59",
      "ConfirmDate":"/Date(1517943899268)/",
      "ConfirmDateIso":"2018-02-06T19:04:59",
      "AuthCode":"031365",
      "TestMode":false,
      "Rrn":"568879820",
      "OriginalTransactionId":null,
      "IpAddress":"185.8.6.164",
      "IpCountry":"RU",
      "IpCity":"Москва",
      "IpRegion":null,
      "IpDistrict":"Москва",
      "IpLatitude":55.75222,
      "IpLongitude":37.61556,
      "CardFirstSix":"411111",
      "CardLastFour":"1111",
      "CardExpDate":"12/22",
      "CardType":"Visa",
      "CardTypeCode":0,
      "Status":"Completed",
      "StatusCode":3,
      "CultureName":"ru",
      "Reason":"Approved",
      "ReasonCode":0,
      "CardHolderMessage":"Оплата успешно проведена",
      "Type":2,
      "Refunded":false,
      "Name":"WQER",
      "SubscriptionId":null,
      "GatewayName":"Tinkoff Payout"
   },
   "Success":true,
   "Message":null
}
```

## Payout by a Token

Payout by a token can be executed through calling of the following API method.

**Method URL:**  
https://api.cloudpayments.ru/payments/token/topup

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Token | String | Required | Card tokens issued by the system. You get it with the first successful payment |
| Amount | Numeric | Required | Payment Amount |
| AccountId | String | Required | Payer's ID |
| Currency | String | Required | Currency |
| InvoiceId | String | Optional | Order or invoice number |
| Payer | Object | Optional | Additional field where information about the payer is sent |
| Receiver | Object | Optional | Additional field where information about the recipient is sent |

**Request example:**

```
{
    "Token":"a4e67841-abb0-42de-a364-d1d8f9f4b3c0",
    "Amount":1,
    "AccountId":"user@example.com",
    "Currency":"RUB",
    "Payer":
      //The set of fields is the same for the Receiver parameter.
      { 
        "FirstName":"Test",
        "LastName":"Test",
        "MiddleName":"Test",
        "Birth":"1955-02-24",
        "Address":"test address",
        "Street":"Lenins",
        "City":"MO",
        "Country":"RU",
        "Phone":"123",
        "Postcode":"345"
    }
}
```

**Response example:**

```
{
   "Model":{
      "PublicId":"pk_b9b86395c99782f0d16386d83e5d8",
      "TransactionId":100551,
      "Amount":1,
      "Currency":"RUB",
      "PaymentAmount":1,
      "PaymentCurrency":"RUB",
      "AccountId":"user@example.com",
      "Email":null,
      "Description":null,
      "JsonData":null,
      "CreatedDate":"/Date(1517943890884)/",
      "PayoutDate":"/Date(1517950800000)/",
      "PayoutDateIso":"2018-02-07T00:00:00",
      "PayoutAmount":1,
      "CreatedDateIso":"2018-02-06T19:04:50",
      "AuthDate":"/Date(1517943899268)/",
      "AuthDateIso":"2018-02-06T19:04:59",
      "ConfirmDate":"/Date(1517943899268)/",
      "ConfirmDateIso":"2018-02-06T19:04:59",
      "AuthCode":"031365",
      "TestMode":false,
      "Rrn":"568879820",
      "OriginalTransactionId":null,
      "IpAddress":"185.8.6.164",
      "IpCountry":"RU",
      "IpCity":"Москва",
      "IpRegion":null,
      "IpDistrict":"Москва",
      "IpLatitude":55.75222,
      "IpLongitude":37.61556,
      "CardFirstSix":"411111",
      "CardLastFour":"1111",
      "CardExpDate":"12/22",
      "CardType":"Visa",
      "CardTypeCode":0,
      "Status":"Completed",
      "StatusCode":3,
      "CultureName":"ru",
      "Reason":"Approved",
      "ReasonCode":0,
      "CardHolderMessage":"Оплата успешно проведена",
      "Type":2,
      "Refunded":false,
      "Name":"WQER",
      "SubscriptionId":null,
      "GatewayName":"Tinkoff Payout"
   },
   "Success":true,
   "Message":null
}
```

## Transaction Details

The method returns a transaction details.

**Method URL:**  
https://api.cloudpayments.ru/payments/get

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Int | Required | Transaction number |

If transaction is found, the system returns information about it.

**Request example:**

```
{"TransactionId":504}
```

**Response example:**

```
{
    "Model": {
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Order №1234567 in shop example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41", //all the dates are in UTC format
        "AuthDate": "\/Date(1401733880523)\/",
        "AuthDateIso":"2014-08-09T11:49:42",
        "ConfirmDate": "\/Date(1401733880523)\/",
        "ConfirmDateIso":"2014-08-09T11:49:42",
        "PayoutDate": "\/Date(1401733880523)\/", 
        "PayoutDateIso":"2014-08-09T11:49:42",
        "PayoutAmount": 99.61, 
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Уфа",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardExpDate": "05/19",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Completed",
        "StatusCode": 3,
        "Reason": "Approved",
        "ReasonCode": 0,
        "CardHolderMessage":"Оплата успешно проведена", //message for payer
        "Name": "CARDHOLDER NAME",
    },
    "Success": true,
    "Message": null
}
```

## Payment Status Check

The method for payment searching which returns it's status (see the [reference](#transaction-statuses)).

**Method URL (old):**  
https://api.cloudpayments.ru/payments/find

**Method URL (new):**  
https://api.cloudpayments.ru/v2/payments/find

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| InvoiceId | String | Required | Order or invoice number |

If a payment for the specified order number is found, the system will return either information about the [successful transaction](#sample-approved) or about the [declined](#sample-declined) If several payments with the specified order number are found, the system will return information about the latest operation only. The difference of the new method is that it searches for all payments, including refunds and payments to the card.

**Request example:**

```
{"InvoiceId":"123456789"}
```

**Response example:**

```
{"Success":false,"Message":"Not found"}
```

## Transaction List

The method to get a list of transactions for a day.

**Method URL:**  
https://api.cloudpayments.ru/payments/list

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Date | Date | Required | Date to check |
| TimeZone | String | Optional | Time zone code, UTC by default |

All the transactions registered on the specified day will be returned in the list. For your convenience, you can specify the time zone code (see the [reference](#timezone-codes))

**Request example:**

```
{"Date":"2019-02-21", "TimeZone": "MSK"}
```

**Response example:**

```
{
    "Model": [{
        "TransactionId": 504,
        "Amount": 10.00000,
        "Currency": "RUB",
        "CurrencyCode": 0,
        "InvoiceId": "1234567",
        "AccountId": "user_x",
        "Email": null,
        "Description": "Payment at example.com",
        "JsonData": null,
        "CreatedDate": "\/Date(1401718880000)\/",
        "CreatedDateIso":"2014-08-09T11:49:41", //all the dates are in chosen time zone
        "AuthDate": "\/Date(1401733880523)\/",
        "AuthDateIso":"2014-08-09T11:49:42",
        "ConfirmDate": "\/Date(1401733880523)\/",
        "ConfirmDateIso":"2014-08-09T11:49:42",
        "PayoutDate": "\/Date(1401733880523)\/", 
        "PayoutDateIso":"2014-08-09T11:49:42",
        "PayoutAmount": 99.61, 
        "TestMode": true,
        "IpAddress": "195.91.194.13",
        "IpCountry": "RU",
        "IpCity": "Уфа",
        "IpRegion": "Республика Башкортостан",
        "IpDistrict": "Приволжский федеральный округ",
        "IpLatitude": 54.7355,
        "IpLongitude": 55.991982,
        "CardFirstSix": "411111",
        "CardLastFour": "1111",
        "CardExpDate": "05/19",
        "CardType": "Visa",
        "CardTypeCode": 0,
        "Issuer": "Sberbank of Russia",
        "IssuerBankCountry": "RU",
        "Status": "Completed",
        "StatusCode": 3,
        "Reason": "Approved",
        "ReasonCode": 0,
        "CardHolderMessage":"Оплата успешно проведена", //message for payer
        "Name": "CARDHOLDER NAME",
    }],
    "Success": true,
}
```

## Token List

The method to get a list of all payment tokens of CloudPayments.

**Method URL:**  
https://api.cloudpayments.ru/payments/tokens/list

**Parameters:**  
none.

**Response example:**

```
{
    "Model": [
        {
            "Token": "tk_020a924486aa4df254331afa33f2a",
            "AccountId": "user_x",
            "CardMask": "4242 42****** 4242",
            "ExpirationDateMonth": 12,
            "ExpirationDateYear": 2020
        },
        {
            "Token": "tk_1a9f2f10253a30a7c5692a3fc4c17",
            "AccountId": "user_x",
            "CardMask": "5555 55****** 4444",
            "ExpirationDateMonth": 12,
            "ExpirationDateYear": 2021
        },
        {
            "Token": "tk_b91062f0f2875909233ab66d0fc7b",
            "AccountId": "user_x",
            "CardMask": "4012 88****** 1881",
            "ExpirationDateMonth": 12,
            "ExpirationDateYear": 2022
        }
    ],
    "Success": true,
    "Message": null
}
```

## Creation of Subscriptions on Recurrent Payments

The method to create subscriptions on recurrent payments.

**Method URL:**  
https://api.cloudpayments.ru/subscriptions/create

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Token | String | Required | Card tokens issued by the system after the first payment |
| AccountId | String | Required | Payer's ID |
| Description | String | Required | Payment description/purpose |
| Email | String | Required | Payer's E-mail |
| Amount | Numeric | Required | Payment amount |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| RequireConfirmation | Bool | Required | If true — payments will work by [DMS](#payment-schemes) |
| StartDate | DateTime | Required | Date time of the first subscription payment in UTC timezone |
| Interval | String | Required | Possible values: Day, Week, Month |
| Period | Int | Required | Works in combination with the Interval, 1 Month means once per mont, 2 Week means once per two weeks |
| MaxPeriods | Int | Optional | Maximum quantity of subscription payments |
| CustomerReceipt | String | Optional | For content of an [online-receipt](#recurrent-payments-subscription-change) changing. |

The system returns a message about the successful operation and the subscription identifier in response to correctly created request.

**Request example:**

```
{  
   "token":"477BBA133C182267FE5F086924ABDC5DB71F77BFC27F01F2843F2CDC69D89F05",
   "accountId":"user@example.com",
   "description":"Monthly subscription on some service at example.com",
   "email":"user@example.com",
   "amount":1.02,
   "currency":"RUB",
   "requireConfirmation":false,
   "startDate":"2014-08-06T16:46:29.5377246Z",
   "interval":"Month",
   "period":1
}
```

**Response example:**

```
{
   "Model":{
      "Id":"sc_8cf8a9338fb8ebf7202b08d09c938", //Subscription ID
      "AccountId":"user@example.com",
      "Description":"Monthly subscription on some service at example.com"
      "Email":"user@example.com",
      "Amount":1.02,
      "CurrencyCode":0,
      "Currency":"RUB",
      "RequireConfirmation":false, //true for enabling the DMS
      "StartDate":"\/Date(1407343589537)\/",
      "StartDateIso":"2014-08-09T11:49:41", //all the dates are in UTC
      "IntervalCode":1,
      "Interval":"Month",
      "Period":1,
      "MaxPeriods":null,
      "StatusCode":0,
      "Status":"Active",
      "SuccessfulTransactionsNumber":0,
      "FailedTransactionsNumber":0,
      "LastTransactionDate":null,
      "LastTransactionDateIso":null, 
      "NextTransactionDate":"\/Date(1407343589537)\/"
      "NextTransactionDateIso":"2014-08-09T11:49:41"
   },
   "Success":true
}
```

## Subscription Details

The method to get an information about subscription status.

**Method URL:**  
https://api.cloudpayments.ru/subscriptions/get

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Id | String | Required | Subscription ID |

**Request example:**

```
{"Id":"sc_8cf8a9338fb8ebf7202b08d09c938"}
```

**Response example:**

```
{
   "Model":{
      "Id":"sc_8cf8a9338fb8ebf7202b08d09c938", //Subscription ID
      "AccountId":"user@example.com",
      "Description":"Monthly subscription on some service at example.com",
      "Email":"user@example.com",
      "Amount":1.02,
      "CurrencyCode":0,
      "Currency":"RUB",
      "RequireConfirmation":false, //true for enabling the DMS
      "StartDate":"\/Date(1407343589537)\/",
      "StartDateIso":"2014-08-09T11:49:41", //all the dates are in UTC
      "IntervalCode":1,
      "Interval":"Month",
      "Period":1,
      "MaxPeriods":null,
      "StatusCode":0,
      "Status":"Active",
      "SuccessfulTransactionsNumber":0,
      "FailedTransactionsNumber":0,
      "LastTransactionDate":null,
      "LastTransactionDateIso":null, 
      "NextTransactionDate":"\/Date(1407343589537)\/"
      "NextTransactionDateIso":"2014-08-09T11:49:41"
   },
   "Success":true
}
```

## Subscriptions Search

The method to get a list of subscriptions for a particular account.

**Method URL:**  
https://api.cloudpayments.ru/subscriptions/find

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| accountId | String | Required | Subscription ID |

**Request example:**

```
{"accountId":"user@example.com"}
```

**Response example:**

```
{
  "Model": [
    {
      "Id": "sc_4bae8f5823bb8cdc966ccd1590a3b",
      "AccountId": "user@example.com",
      "Description": "Subscription on some service",
      "Email": "user@example.com",
      "Amount": 1.02,
      "CurrencyCode": 0,
      "Currency": "RUB",
      "RequireConfirmation": false,
      "StartDate": "/Date(1473665268000)/",
      "StartDateIso": "2016-09-12T15:27:48",
      "IntervalCode": 1,
      "Interval": "Month",
      "Period": 1,
      "MaxPeriods": null,
      "CultureName": "ru",
      "StatusCode": 0,
      "Status": "Active",
      "SuccessfulTransactionsNumber": 0,
      "FailedTransactionsNumber": 0,
      "LastTransactionDate": null,
      "LastTransactionDateIso": null,
      "NextTransactionDate": "/Date(1473665268000)/",
      "NextTransactionDateIso": "2016-09-12T15:27:48"
    },
    {
      "Id": "sc_b4bdedba0e2bdf279be2e0bab9c99",
      "AccountId": "user@example.com",
      "Description": "Subscription on some service #2",
      "Email": "user@example.com",
      "Amount": 3.04,
      "CurrencyCode": 0,
      "Currency": "RUB",
      "RequireConfirmation": false,
      "StartDate": "/Date(1473665268000)/",
      "StartDateIso": "2016-09-12T15:27:48",
      "IntervalCode": 0,
      "Interval": "Week",
      "Period": 2,
      "MaxPeriods": null,
      "CultureName": "ru",
      "StatusCode": 0,
      "Status": "Active",
      "SuccessfulTransactionsNumber": 0,
      "FailedTransactionsNumber": 0,
      "LastTransactionDate": null,
      "LastTransactionDateIso": null,
      "NextTransactionDate": "/Date(1473665268000)/",
      "NextTransactionDateIso": "2016-09-12T15:27:48"
    }
  ],
  "Success": true,
  "Message": null
}
```

## Recurrent Payments Subscription Change

The method to change a subscription on recurrent payments.

**Method URL:**  
https://api.cloudpayments.ru/subscriptions/update

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Id | String | Required | Subscription ID |
| Description | String | Optional | Description of change |
| Amount | Numeric | Optional | Amount to change to |
| Currency | String | Optional | Currency: RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| RequireConfirmation | Bool | Optional | If true — payments will work by [DMS](#payment-schemes) |
| StartDate | DateTime | Optional | For date of the first (or the next following) payment in UTC zone changing. |
| Interval | String | Optional | For interval changing. Possible values: Week, Month |
| Period | Int | Optional | For period changing. In combination with the Interval, 1 Month means once per month, 2 Week means once per two weeks. |
| MaxPeriods | Int | Optional | For max periods of recurring payments changing. |
| CustomerReceipt | String | Optional | For content of an [online-receipt](#recurrent-payments-subscription-change) changing. |

The system returns a message with the successful operation and subscription parameters in response to correctly created request.

**Request example:**

```
{  
   "Id":"sc_8cf8a9338fb8ebf7202b08d09c938",
   "description":"Rate №5",
   "amount":1200,
   "currency":"RUB"
}
```

**Response example:**

```
{
   "Model":{
      "Id":"sc_8cf8a9338fb8ebf7202b08d09c938", //Subscription ID
      "AccountId":"user@example.com",
      "Description":"Rate №5",
      "Email":"user@example.com",
      "Amount":1200,
      "CurrencyCode":0,
      "Currency":"RUB",
      "RequireConfirmation":false, //true for enabling the DMS
      "StartDate":"\/Date(1407343589537)\/",
      "StartDateIso":"2014-08-09T11:49:41", //all the dates are in UTC
      "IntervalCode":1,
      "Interval":"Month",
      "Period":1,
      "MaxPeriods":null,
      "StatusCode":0,
      "Status":"Active",
      "SuccessfulTransactionsNumber":0,
      "FailedTransactionsNumber":0,
      "LastTransactionDate":null,
      "LastTransactionDateIso":null, 
      "NextTransactionDate":"\/Date(1407343589537)\/"
      "NextTransactionDateIso":"2014-08-09T11:49:41"
   },
   "Success":true
}
```

## Subscription on Recurrent Payments Cancellation

The method to cancel subscription on recurrent payments.

**Method URL:**

https://api.cloudpayments.ru/subscriptions/cancel

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Id | String | Required | Subscription ID |

The system returns a message about the successful operation in response to correctly created request.

**Request example:**

```
{"Id":"sc_cc673fdc50b3577e60eee9081e440"}
```

**Response example:**

```
{"Success":true,"Message":null}
```

You can also provide a link to the system’s website — **https://my.cloudpayments.ru/unsubscribe**, where payer can independently find and cancel his or her regular payments.

## Invoice Creation on Email

The method to generate a payment link and sending it to a payer's email.

**Method URL:**  
https://api.cloudpayments.ru/orders/create

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Amount | Numeric | Required | Payment Amount |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP (see the [reference](#currency-list)) |
| Description | String | Required | Payment description/purpose |
| Email | String | Optional | Payer's E-mail |
| RequireConfirmation | Bool | Optional | If true — payments will work by [DMS](#payment-schemes) |
| SendEmail | Bool | Optional | If true — payer will get an email with the link on the invoice |
| InvoiceId | String | Optional | Order or Invoice number |
| AccountId | String | Optional | Payer's ID |
| OfferUri | String | Optional | Link to the offer that will be shown on the order page |
| Phone | String | Optional | Free format phone number of the payer |
| SendSms | Bool | Optional | If true — payer will get a SMS with the link on the invoice |
| SendViber | Bool | Optional | If true — payer will get a Viber message with the link on the invoice |
| CultureName | String | Optional | Notifications language. Possible values: "ru-RU", "en-US" |
| SubscriptionBehavior | String | Optional | For subscription creation. Possible values: CreateWeekly, CreateMonthly |
| SuccessRedirectUrl | String | Optional | Page address for redirect upon successful payment |
| FailRedirectUrl | String | Optional | Page address for redirecting in case of unsuccessful payment |
| JsonData | Json | Optional | Any other data that will be associated with the transaction, including the instructions for generation of [online-receipt](#online-receipt-format-parameters) |

**Request example:**

```
{
    "Amount":10.0,
    "Currency":"RUB",
    "Description":"Payment at website example.com",
    "Email":"client@test.local",
    "RequireConfirmation":true,
    "SendEmail":false
}
```

**Response example:**

```
{
    "Model":{
        "Id":"f2K8LV6reGE9WBFn",
        "Number":61,
        "Amount":10.0,
        "Currency":"RUB",
        "CurrencyCode":0,
        "Email":"client@test.local",
        "Description":"Payment at website example.com",
        "RequireConfirmation":true,
        "Url":"https://orders.cloudpayments.ru/d/f2K8LV6reGE9WBFn",
    },
    "Success":true,
}
```

## Created Invoice Cancellation

The method to create invoice cancellation.

**Method URL:**

https://api.cloudpayments.ru/orders/cancel

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Id | String | Required | Invoice ID |

The system returns a message about the successful operation in response to correctly created request.

**Request example:**

```
{"Id":"f2K8LV6reGE9WBFn"}
```

**Response example:**

```
{"Success":true,"Message":null}
```

## View of Notification Settings

The method to view notification settings (with selection of notification type).

**Method URL:**

https://api.cloudpayments.ru/site/notifications/{Type}/get

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Type | String | Required | Notification type: Check/Pay/Fail and so on (see the [reference](#operation-types)) |

**Response example** on [Pay](#pay) notification:  
https://api.cloudpayments.ru/site/notifications/pay/get

```
{
    "Model": {
        "IsEnabled": true,
        "Address": "http://example.com",
        "HttpMethod": "GET",
        "Encoding": "UTF8",
        "Format": "CloudPayments"
    },
    "Success": true,
    "Message": null
}
```

## Change of Notification Settings

The method to change notification settings.

**Method URL:**

https://api.cloudpayments.ru/site/notifications/{Type}/update

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| Type | String | Required | Notification type: Pay, Fail and so on except Check (see the [reference](#operation-types)) |
| IsEnabled | Bool | Optional | True is enabled, Default is false. |
| Address | String | Optional if `IsEnabled=false`, else Required | Address for sending notifications (for HTTPS schemes a valid SSL certificate is required). |
| HttpMethod | String | Optional | HTTP method for sending notifications. Possible values: GET, POST. The default is GET. |
| Encoding | String | Optional | Encoding of notifications. Possible values: UTF8, Windows1251. The default is UTF8. |
| Format | String | Optional | The format of the notifications. Possible values: CloudPayments, QIWI, RT. The default is CloudPayments. |

**Example request** for [Pay](#pay) notification:  
https://api.cloudpayments.ru/site/notifications/pay/update:

```
{
    "IsEnabled": true,
    "Address": "http://example.com",
    "HttpMethod": "GET",
    "Encoding": "UTF8",
    "Format": "CloudPayments"
}
```

**Response example:**

```
{"Success":true,"Message":null}
```

## Start of Apple Pay Session

Start of session is required to take payments via [Apple Pay](#apple-pay) in Web. It is not required for Mobile platforms.

**Method URL:**  
https://api.cloudpayments.ru/applepay/startsession

**Parameters:**

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| ValidationUrl | String | Required | Address received in Apple JS |
| paymentUrl | String | Optional | Address for starting a session in Apple |

The system returns a session in the Model object for paying via Apple Pay in JSON response to correctly created request.

**Request example:**

```
{"ValidationUrl":"https://apple-pay-gateway.apple.com/paymentservices/startSession"}
```

**Response example:**

```
{
    "Model": {
        "epochTimestamp": 1545111111153,
        "expiresAt": 1545111111153,
        "merchantSessionIdentifier": "SSH6FE83F9B853E00F7BD17260001DCF910_0001B0D00068F71D5887F2726CFD997A28E0ED57ABDACDA64934730A24A31583",
        "nonce": "d6358e06",
        "merchantIdentifier": "41B8000198128F7CC4295E03092BE5E287738FD77EC3238789846AC8EF73FCD8",
        "domainName": "demo.cloudpayments.ru",
        "displayName": "demo.cloudpayments.ru",
        "signature": "308006092a864886f70d010702a0803080020101310f300d06096086480165030402010500308006092a864886f70d0107010000a080308203e230820388a00307650202082443f2a8069df577300a06082a8648ce3d040302307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b3009060355040613025553301e170d3134303932353232303631315a170d3139303932343232303631315a305f3125302306035504030c1c6563632d736d702d62726f6b65722d7369676e5f5543342d50524f4431143012060355040b0c0b694f532053797374656d7331133011060355040a0c0a4170706c6520496e632e310b30090603550406130255533059301306072a8648ce3d020106082a8648ce3d03010703420004c21577edebd6c7b2218f68dd7090a1218dc7b0bd6f2c283d846095d94af4a5411b83420ed811f3407e83331f1c54c3f7eb3220d6bad5d4eff49289893e7c0f13a38202113082020d304506082b0601050507010104393037303506082b060105050730018629687474703a2f2f6f6373702e6170706c652e636f6d2f6f63737030342d6170706c6561696361333031301d0603551d0e041604149457db6fd57481868989762f7e578507e79b5824300c0603551d130101ff04023000301f0603551d2304183016801423f249c44f93e4ef27e6c4f6286c3fa2bbfd2e4b3082011d0603551d2004820114308201103082010c06092a864886f7636405013081fe3081c306082b060105050702023081b60c81b352656c69616e6365206f6e207468697320636572746966696361746520627920616e7920706172747920617373756d657320616363657074616e6365206f6620746865207468656e206170706c696361626c65207374616e64617264207465726d7320616e6420636f6e646974696f6e73206f66207573652c20636572746966696361746520706f6c69637920616e642063657274696669636174696f6e2070726163746963652073746174656d656e74732e303606082b06010505070201162a687474703a2f2f7777772e6170706c652e636f6d2f6365727469666963617465617574686f726974792f30340603551d1f042d302b3029a027a0258623687474703a2f2f63726c2e6170706c652e636f6d2f6170706c6561696361332e63726c300e0603551d0f0101ff040403020780300f06092a864886f76364061d04020500300a06082a8648ce3d04030203480030450220728a9f0f92a32ab999742bd55eb67340572a9687a1d62ef5359710f5163e96e902210091379c7d6ebe5b9974af40037f34c23ead98b5b4b7f70d355c86b2a81372f1b1308202ee30820275a0030201020208496d2fbf3a98da97300a06082a8648ce3d0403023067311b301906035504030c124170706c6520526f6f74204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b3009060355040613025553301e170d3134303530363233343633305a170d3239303530363233343633305a307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b30090603550406130255533059301306072a8648ce3d020106082a8648ce3d03010703420004f017118419d76485d51a5e25810776e880a2efde7bae4de08dfc4b93e13356d5665b35ae22d097760d224e7bba08fd7617ce88cb76bb6670bec8e82984ff5445a381f73081f4304606082b06010505070101043a3038303606082b06010505073001862a687474703a2f2f6f6373702e6170706c652e636f6d2f6f63737030342d6170706c65726f6f7463616733301d0603551d0e0416041423f249c44f93e4ef27e6c4f6286c3fa2bbfd2e4b300f0603551d130101ff040530030101ff301f0603551d23041830168014bbb0dea15833889aa48a99debebdebafdacb24ab30370603551d1f0430302e302ca02aa0288626687474703a2f2f63726c2e6170706c652e636f6d2f6170706c65726f6f74636167332e63726c300e0603551d0f0101ff0404030201063010060a2a864886f7636406020e04020500300a06082a8648ce3d040302036700306402303acf7283511699b186fb35c356ca62bff417edd90f754da28ebef19c815e42b789f898f79b599f98d5410d8f9de9c2fe0230322dd54421b0a305776c5df3383b9067fd177c2c216d964fc6726982126f54f87a7d1b99cb9b0989216106990f09921d00003182018d30820189020123458186307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b300906035504061302555302082443f2a8069df577300d06096086480165030402010500a08195301806092a864886f70d010903310b06092a864886f70d010701301c06092a864886f70d010905310f170d3138313232303134323633395a302a06092a864886f70d010934311d301b300d06096086480165030402010500a10a06082a8648ce3d040302302f06092a864886f70d0109043122042066adfefd6fbe307934525c52b926dcf0734a2e8011a9c8558d7043d983960af3300a06082a8648ce3d04030204483046022100fc6436b2c9bde03c4691d2e3b0e23aca06e44ce0c05c7ff4fb34550f4079dd36022100d1c91be8ed57321fb1c7264f1a617311ed678609a75fed3be31cc0d5cea16cfe000000000000"
    },
    "Success": true,
    "Message": null
}
```

## Localization

The API issues messages for users are in Russian by default. You need to pass the **CultureName** parameter to localize language.

**Supported languages:**

| Language | TimeZone | Code |
| --- | --- | --- |
| Russian | MSK | ru-RU |
| English | CET | en-US |
| Latvian | CET | lv |
| Azerbaijani | AZT | az |
| Russian | ALMT | kk |
| Ukrainian | EET | uk |
| Polish | CET | pl |
| Vietnamese | ICT | vi |
| Turkish | TRT | tr |

## Airline Addendum

**airline addendum** is extended information about an itinerary receipt which is transmitted to the payment system with a transaction for processing. Usage of airline addendum allows you to reduce the risk of fraudulent transactions and lower the cost of payments processing. It consists of information about a route receipt, segments (flights), and passengers.

Information on an itinerary receipt includes:

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| BookingRef | String | Required, no ticket number is specified | Booking number |
| TicketNumber | String | Required, if no reservation number is specified | Ticket number |

A segment means one flight: takeoff and landing. You must specify all segments of the route with a list of the following parameters:

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| FlightNumber | String | Required | Flight number |
| DepartureDateTime | DateTime | Required | Departure date and time |
| ArrivalDateTime | DateTime | Required | Arrival date and time |
| OriginatingCountry | String | Required | Country of departure in Russian or English |
| OriginatingCity | String | Required | Departure city in Russian or English |
| OriginatingAirportCode | String(3) | Required | Departure airport code - 3 letters by IATA classification |
| DestinationCountry | String | Required | Arrival country in Russian or English |
| DestinationCity | String | Required | Arrival City in Russian or English |
| DestinationAirportCode | String(3) | Required | Arrival airport code - 3 letters by IATA classification |

For providing of information about passengers, it is necessary to specify name and surname in Latin letters for each of them:

| Parameter | Type | Use | Description |
| --- | --- | --- | --- |
| FirstName | String | Required | Passenger name |
| LastName | String | Required | Passenger surname |

AirlineAddendum can be submitted in parameter **AirlineAddendum** using any [API](#api) payment method or via reply on [check](#check) notification.

**Example of airline addendum:**

```
{
   "TicketNumber":"390 5241025377",
   "BookingRef":null,
   "Legs":[
      {
         "FlightNumber":"A3 971",
         "DepartureDateTime":"2014-05-26T05:15:00",
         "ArrivalDateTime":"2014-05-26T07:30:00",
         "OriginatingCountry":"Россия",
         "OriginatingCity":"Москва",
         "OriginatingAirportCode":"DME",
         "DestinationCountry":"Греция",
         "DestinationCity":"Афины",
         "DestinationAirportCode":"ATH"
      },
      {
         "FlightNumber":"A3 204",
         "DepartureDateTime":"2014-05-26T09:45:00",
         "ArrivalDateTime":"2014-05-26T10:50:00",
         "OriginatingCountry":"Греция",
         "OriginatingCity":"Афины",
         "OriginatingAirportCode":"ATH",
         "DestinationCountry":"Греция",
         "DestinationCity":"Родос",
         "DestinationAirportCode":"RHO"
      },
      {
         "FlightNumber":"A3 980",
         "DepartureDateTime":"2014-06-06T09:00:00",
         "ArrivalDateTime":"2014-06-06T13:45:00",
         "OriginatingCountry":"Греция",
         "OriginatingCity":"Родос",
         "OriginatingAirportCode":"RHO",
         "DestinationCountry":"Россия",
         "DestinationCity":"Москва",
         "DestinationAirportCode":"DME"
      }
   ],
   "Passengers":[
      {
         "FirstName":"KONSTANTIN",
         "LastName":"IVANOV"
      },
      {
         "FirstName":"JULIA",
         "LastName":"IVANOVA"
      }
   ]
}
```

## Notifications

Notification is an HTTP request from the system to your site. Similar requests are also called **callback** or **webhook**. The system provides several types of notifications: check whether it is possible to make a payment, information about successful and unsuccessful payments, notification about changes of subscriptions on recurrent payments, and also information about generated online-receipts.

## Check

The Check notification is performed once a cardholder filled in a payment form and pressed the “Pay” button. It serves the purpose of payment validation: the system sends a request to a merchant's website address with payment information, and the website must validate and define if it's needed to confirm or reject the payment.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Transaction number in the system |
| Amount | Numeric, dot as separator, two digits after dot | Required | Amount specified in payment parameters |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP specified in payment parameters (see [reference](#currency-list)) |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Payment creation date / time in the UTC time zone |
| CardFirstSix | String(6) | Required | First 6 digits of a card number |
| CardLastFour | String(4) | Required | Last 4 digits of a card number |
| CardType | String | Required | Card Payment System: Visa, MasterCard, Maestro, or MIR |
| CardExpDate | String | Required | Expiration date in MM/YY format |
| TestMode | Bit (1 or 0) | Required | Test mode sign |
| Status | String | Required | Payment status if successful: `Completed` — for [SMS sheme](#payment-schemes), `Authorized` — for [DMS scheme](#payment-schemes) |
| OperationType | String | Required | Transaction type: Payment/Refund/CardPayout (see [reference](#operation-types)) |
| InvoiceId | String | Optional | Order number specified in payment parameters |
| AccountId | String | Optional | Payer's ID specified in payment parameters |
| SubscriptionId | String | Optional | Subscription identifier (for recurrent payments) |
| TokenRecipient | String | Optional | Token for payouts |
| Name | String | Optional | Cardholder's name |
| Email | String | Optional | Payer's E-mail address |
| IpAddress | String | Optional | Payer's IP address |
| IpCountry | String(2) | Optional | Two-letter code of a country of a payer's location by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| IpCity | String | Optional | Payer's location city |
| IpRegion | String | Optional | Payer's location region |
| IpDistrict | String | Optional | Payer's location district |
| Issuer | String | Optional | Name of a card issuing bank |
| IssuerBankCountry | String(2) | Optional | Two-letter country code of a card issuer by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| Description | String | Optional | Payment description specified in payment parameters |
| Data | Json | Optional | An arbitrary set of parameters passed to the transaction |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take the following values:

| Code | Description | Result |
| --- | --- | --- |
| 0 | Payment can be done | The system will authorize a payment |
| 10 | Invalid order number | Payment will be declined |
| 11 | Invalid AccountId | Payment will be declined |
| 12 | Invalid amount | Payment will be declined |
| 13 | Payment cannot be accepted | Payment will be declined |
| 20 | Payment overdue | Payment will be declined, a payer will receive a notification |

## Pay

The Pay notification is performed once a payment is successfully completed and an issuer's authorization is received.

It serves the purpose of information about a payment: the system sends a request to a merchant's website address with payment information, and the merchant's site has to register the fact of payment.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Transaction number in the system |
| Amount | Numeric, dot as separator, two digits after dot | Required | Amount specified in payment parameters |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP specified in payment parameters (see [reference](#currency-list)) |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Payment creation date / time in the UTC time zone |
| CardFirstSix | String(6) | Required | First 6 digits of a card number |
| CardLastFour | String(4) | Required | Last 4 digits of a card number |
| CardType | String | Required | Card Payment System: Visa, MasterCard, Maestro or MIR |
| CardExpDate | String | Required | Expiration date in MM/YY format |
| TestMode | Bit (1 or 0) | Required | Test mode sign |
| Status | String | Required | Payment status once authorized: `Completed` — for [SMS sheme](#payment-schemes), `Authorized` — for [DMS scheme](#payment-schemes) |
| OperationType | String | Required | Operation type: Payment/Refund/CardPayout (see reference) |
| GatewayName | String | Required | Acquiring Bank Identifier |
| InvoiceId | String | Optional | Order or Invoice number specified in payment parameters |
| AccountId | String | Optional | Payer's ID specified in payment parameters |
| SubscriptionId | String | Optional | Subscription identifier (for recurrent payments) |
| Name | String | Optional | Cardholder's name |
| Email | String | Optional | Payer's E-mail address |
| IpAddress | String | Optional | Payer's IP address |
| IpCountry | String(2) | Optional | The Two-letter code of a country of a payer's location by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| IpCity | String | Optional | Payer's location city |
| IpRegion | String | Optional | Payer's location region |
| IpDistrict | String | Optional | Payer's location district |
| Issuer | String | Optional | Name of a card issuing bank |
| IssuerBankCountry | String(2) | Optional | Two-letter country code of a card issuer by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| Description | String | Optional | Payment description specified in payment parameters |
| Data | Json | Optional | Arbitrary set of parameters passed to a transaction |
| Token | String | Optional | Token of a card for further payments without entering of card data |
| TotalFee | Decimal | Required | Total fee value |
| CardProduct | String | Optional | Card Product Type |
| PaymentMethod | String | Optional | Payment Method ApplePay or GooglePay |
| FallBackScenarioDeclinedTransactionId | Int | Optional | First unsuccessful transaction number |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Payment is registered |

## Fail

The Fail notification is performed if a payment was declined and is used to analyze a number and causes of failures.

You need to consider that a fact of decline is not final since a user can pay the second time.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Transaction number in the system |
| Amount | Numeric, dot as separator, two digits after dot | Required | Amount specified in payment parameters |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP specified in the payment parameters (see [reference](#currency-list)) |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Payment creation date / time in the UTC time zone |
| CardFirstSix | String(6) | Required | First 6 digits of a card number |
| CardLastFour | String(4) | Required | Last 4 digits of a card number |
| CardType | String | Required | Card Payment System: Visa, MasterCard, Maestro or MIR |
| CardExpDate | String | Required | Expiration date in MM/YY format |
| TestMode | Bit (1 or 0) | Required | Test mode sign |
| Reason | String | Required | Decline reason |
| ReasonCode | Int | Required | Error Code (see the reference) |
| OperationType | String | Required | Operation type: Payment/Refund/CardPayout (see [reference](#operation-types)) |
| InvoiceId | String | Optional | Order or Invoice number specified in payment parameters |
| AccountId | String | Optional | Payer's ID specified in payment parameters |
| SubscriptionId | String | Optional | Subscription identifier (for recurrent payments) |
| Name | String | Optional | Cardholder's name |
| Email | String | Optional | Payer's E-mail address |
| IpAddress | String | Optional | Payer's IP address |
| IpCountry | String(2) | Optional | The Two-letter code of a country of a payer's location by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| IpCity | String | Optional | Payer's location city |
| IpRegion | String | Optional | Payer's location region |
| IpDistrict | String | Optional | Payer's location district |
| Issuer | String | Optional | Name of a card issuing bank |
| IssuerBankCountry | String(2) | Optional | Two-letter country code of a card issuer by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| Description | String | Optional | Payment description specified in payment parameters |
| Data | Json | Optional | Arbitrary set of parameters passed to a transaction |
| Token | String | Optional | Token of a card for further payments without entering of card data |
| PaymentMethod | String | Optional | Payment Method ApplePay or GooglePay |
| FallBackScenarioDeclinedTransactionId | Int | Optional | First unsuccessful transaction number |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Attempt is registered |

## Confirm

The Confirm notification is performed by the [DMS scheme](#payment-schemes).

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Transaction number in the system |
| Amount | Numeric, dot as separator, two digits after dot | Required | Amount specified in payment parameters |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP specified in the payment parameters (see [reference](#currency-list)) |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Payment creation date / time in the UTC time zone |
| CardFirstSix | String(6) | Required | First 6 digits of a card number |
| CardLastFour | String(4) | Required | Last 4 digits of a card number |
| CardType | String | Required | Card Payment System: Visa, MasterCard, Maestro or MIR |
| CardExpDate | String | Required | Expiration date in MM/YY format |
| TestMode | Bit (1 or 0) | Required | Test mode sign |
| Status | String | Required | Payment status once authorized: `Completed` |
| InvoiceId | String | Optional | Order or Invoice number specified in payment parameters |
| AccountId | String | Optional | Payer's ID specified in payment parameters |
| SubscriptionId | String | Optional | Subscription identifier (for recurrent payments) |
| Name | String | Optional | Cardholder's name |
| Email | String | Optional | Payer's E-mail address |
| IpAddress | String | Optional | Payer's IP address |
| IpCountry | String(2) | Optional | The Two-letter code of a country of a payer's location by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| IpCity | String | Optional | Payer's location city |
| IpRegion | String | Optional | Payer's location region |
| IpDistrict | String | Optional | Payer's location district |
| Issuer | String | Optional | Name of a card issuing bank |
| IssuerBankCountry | String(2) | Optional | Two-letter country code of a card issuer by [ISO3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) |
| Description | String | Optional | Payment description specified in payment parameters |
| Data | Json | Optional | Arbitrary set of parameters passed to a transaction |
| Token | String | Optional | Token of a card for further payments without entering of card data |
| PaymentMethod | String | Optional | Payment Method ApplePay or GooglePay |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Payment is registered |

## Refund

The Refund notification is performed if a payment was refunded (fully or partially) on your initiative via the [API](#refund) or Back Office.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Refund transaction number in the system |
| PaymentTransactionId | Int | Required | Payment transaction number in the system (original) |
| Amount | Numeric, dot as separator, two digits after dot | Required | Refund amount in payment currency |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Refund date / time in UTC time zone |
| OperationType | String | Required | Operation type: Payment/Refund/CardPayout (see [reference](#operation-types)) |
| InvoiceId | String | Optional | Invoice or Order number of the original transaction |
| AccountId | String | Optional | Payer's ID of the original transaction |
| Email | String | Optional | Payer's E-mail address |
| Data | Json | Optional | Arbitrary set of parameters passed to a transaction |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Refund is registered |

## Recurrent

The Recurrent notification is performed if the recurring payment subscription status was changed.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| Id | Int | Required | Subscription identifier |
| AccountId | String | Required | Payer's ID |
| Description | String | Required | Paymet Description |
| Email | String | Required | Payer's E-mail address |
| Amount | Numeric | Required | Payment amount |
| Currency | String | Required | Currency: RUB/USD/EUR/GBP specified in payment parameters (see [reference](#currency-list)) |
| RequireConfirmation | Bool | Required | If `true` then a payment will be made by the [DMS scheme](#payment-schemes) |
| StartDate | DateTime | Required | Date and time of the first payment according to the plan in the UTC time zone |
| Interval | String | Required | Interval. Possible values are `Week`, `Month` |
| Period | Int | Required | Period. In combination with the interval 1 Month means once a month, 2 Week means once every two weeks. |
| Status | String | Required | [Subscription statuses](#subscription-statuses-recurrents) |
| SuccessfulTransactionsNumber | Int | Required | Number of successful payments |
| FailedTransactionsNumber | Int | Required | Number of unsuccessful payments (reset after each successful) |
| MaxPeriods | Int | Optional | Maximum number of payments per subscription |
| LastTransactionDate | yyyy-MM-dd HH:mm:ss | Optional | Date and time of the last successful payment in the UTC time zone |
| NextTransactionDate | yyyy-MM-dd HH:mm:ss | Optional | Date and time of the next payment in the UTC time zone |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Changes are registered |

## Cancel

The Cancel notification is performed by the [DMS scheme](#payment-schemes) once payment was canceled via the [API](#api) or Back Office.

The list of parameters transmitted in the request body is presented in the table:

| Parameter | Format | Use | Description |
| --- | --- | --- | --- |
| TransactionId | Numeric | Required | Canceled transaction number in the system |
| Amount | Numeric, dot as separator, two digits after dot | Required | Canceled transaction amount in a payment currency |
| DateTime | yyyy-MM-dd HH:mm:ss | Required | Cancellation date / time in the UTC time zone |
| InvoiceId | String | Optional | Order number of an operation |
| AccountId | String | Optional | Payer's ID of a canceled operation |
| Email | String | Optional | Payer's E-mail address |
| Data | Json | Optional | Arbitrary set of parameters passed to a transaction |

The system expects a response in JSON format with the required parameter **code**:

```
{"code":0}
```

The code defines a payment result and can take only one value:

| Code | Value |
| --- | --- |
| 0 | Refund is registered |

## Notification Validation

All the notifications — [check](#check), [pay](#pay), [fail](#fail), [confirm](#confirm), [cancel](#cancel), [refund](#refund), and [recurrent](#recurrent) - have the **X-Content-HMAC** and **Content-HMAC** HTTP headers which contains a validation value of a request which is calculated using the [HMAC](https://en.wikipedia.org/wiki/HMAC) algorithm. The only difference is that the first one is generated from URL decoded (or not encoded) parameters, and the second one is generated from URL encoded parameters (which can cause problems). If you need to verify authenticity and integrity of notifications, you can calculate a validation value on your side and compare it with the request value. The coincidence confirms that you received the notification we sent in the original form.

Please pay attention to the following points when implementing notification validation:

- For notifications sent by **POST** method the message is represented by a request body. For **GET** method it is string parameters;
- When calculating HMAC, use **UTF8** encoding;
- Hash is calculated by **SHA256** function;
- The secret API is used as a key, which can be obtained in your Back Office;
- The calculated value is passed in **base64** encoding.

[HMAC calculation Examples](https://www.jokecamp.com/blog/examples-of-creating-base64-hashes-using-hmac-sha256-in-different-languages/) in different programming languages.

The system sends notifications from the following addresses: **130.193.70.192**, **185.98.85.109**, **91.142.84.0/27**, **87.251.91.160/27** and **185.98.81.0/28**.

For you, this means that:

- If you do not use Pay / Check / Fail / Confirm / Refund / Recurrent / Cancel notifications, then you do not need to do anything;
- If you are using at least one of these notifications, then you need to check which https encryption protocols your server supports. If your server only supports SSL3, then you need to upgrade it to at least TLS11. It will be even better if you upgrade to TLS13. As a last resort, you can translate notifications to the http protocol.

Learn more [how to opt out of SSL3](https://disablessl3.com/). After June 8, https notifications to servers that support only SSL3 may not be delivered.  
  

## Apple Pay

![image1](https://developers.cloudpayments.ru/en/images/image1.png)

Apple Pay is a modern, convenient, and secure payment method by Apple. Once a payer binds a card to a phone, he or she is able to confirm a payment with a fingerprint or Face ID when paying. The technology works in mobile applications, and Safari browser on iPhone, iPad, Apple Watch, and the latest MacBooks.

Apple Pay works with Visa and MasterCard cards and is available to all organizations and individual entrepreneurs working with CloudPayments without additional agreements and changes in agreement conditions.

You can test payment via Apple Pay in our [Demo Store](https://show.cloudpayments.ru/). You can use either [test](#testing) or real card data. Money withdrawal will not occur.

## Classic Integration

**Apple Pay Merchant ID, certificates, and domains**

In order to use Apple Pay technology, you need to register a Merchant ID, generate a payment certificate and a certificate for web payments, and confirm that you own domains of sites on which payment will be made.

**Merchant ID registration:**

1. Log in to the [Apple Developer Account](https://developer.apple.com/) console to the section **«Certificates, IDs & Profiles»**, then **«Merchant IDs»**. Register new Merchant ID:
	- In the **Description** field, enter a description;
		- In the **Identifier** field, specify the address of your main site in the reverse order and with the prefix **“merchant”**. For example, if the address of your main site is **shop.domain.ru**, then **Identitfier** is **merchant.ru.domain.shop**.
2. Save the result.

**Certificates creation:**

1. Email tо **support@cloudpayments.ru** with your registered Apple Merchant ID. Our support team will generate two requests for certificates and send it back. The process takes no more than 10 minutes, but it can be delayed depending on the workload.
2. In the [Apple Developer](https://developer.apple.com/) console generate two cetificates: Payment Processing Certificate and Merchant Identity Certificate. Send both to our support.

**Domain validation:**

1. Add the domain names to the [Apple Developer](https://developer.apple.com/) console for each site where you plan to accept payments via Apple Pay. Please note that sites must work through **HTTPS** and support the **TLS 1.2** protocol.
2. Confirm domain ownership.

In the [widget](#payment-widget) it will be possible to pay via Apple Pay.

**Taking payments with Apple Pay**

The payment scheme includes 3 stages:

- Device compatibility check. If a device is supported, you need to show the Apple Pay button to a payer;
- Payment authorization. It is a payment confirmation by a payer by entering a code or a fingerprint;
- Payment processing. Once confirmed, Apple generates an encrypted token that needs to be sent to the CloudPayments API.

**Apple Pay in Mobile Applications**

Use Apple's PassKit SDK to get a PaymentToken and the cryptogram payment method in the CloudPayments API for making a payment.

![image4-2](https://developers.cloudpayments.ru/en/images/image1-4.png)

**Manual placement of Apple Pay on the site**

If you want to place the Apple Pay button directly on your website like in the example below (not via the payment [widget](#payment-widget)), then follow the further instructions.

Integration involves usage of a client part (javascript) and a server. On a client part you need to check compatibility of a device and process the next events: a session creation, a payment authorization, and a payment processing.

**On a server side, you need to make API calls:**

1. Apple Pay [session start](#start-of-apple-pay-session);
2. Payment [by a cryptogram](#payment-by-a-cryptogram).

**Js-code example:**

```
if (window.ApplePaySession) { //device check
    var merchantIdentifier = 'Ваш Apple Merchant ID';
    var promise = ApplePaySession.canMakePaymentsWithActiveCard(merchantIdentifier);
    promise.then(function (canMakePayments) {
        if (canMakePayments) {
            $('#apple-pay').show(); // Apple Pay button
        }
    });
}
$('#apple-pay').click(function () { //button handler
    var request = {
        // requiredShippingContactFields: ['email'], uncomment if you need an e-mail. You can also request postalAddress, phone, name. 
        countryCode: 'RU',
        currencyCode: 'RUB',
        supportedNetworks: ['visa', 'masterCard'],
        merchantCapabilities: ['supports3DS'],
        //specify the description of payment only in Latin!
        total: { label: 'Test', amount: '1.00' }, //payment description and amount
    }
    var session = new ApplePaySession(1, request);

    // event handler to create merchant session.
    session.onvalidatemerchant = function (event) {

        var data = {
            validationUrl: event.validationURL
        };

        // send a request to your server, and then request the CloudPayments API
        // for session start
        $.post("/ApplePay/StartSession", data).then(function (result) {
            session.completeMerchantValidation(result.Model);
        });
    };

    // payment authorization event handler
    session.onpaymentauthorized = function (event) {

        //var email = event.payment.shippingContact.emailAddress; //if the e-mail address was requested
        //var phone = event.payment.shippingContact.phoneNumber; //if the phone was requested
        //see all the options at https://developer.apple.com/reference/applepayjs/paymentcontact

        var data = {
            cryptogram: JSON.stringify(event.payment.token)
        };

        //send a request to your server, and then request the CloudPayments API
        //to make a payment
        $.post("/ApplePay/Pay", data).then(function (result) {
            var status;
            if (result.Success) {
                status = ApplePaySession.STATUS_SUCCESS;
            } else {
                status = ApplePaySession.STATUS_FAILURE;
            }

            session.completePayment(status);
        });
    };

    //Apple Pay session start
    session.begin();
});
```

## Simplified Integration (Web Only)

We simplified the registration procedure at Apple. For websites, creating an account in the [Apple Developer](https://developer.apple.com/) console using our payment solutions is no longer necessary.  
It is sufficient now in the [Back Office](https://merchant.cloudpayments.ru/login) in site configuration:

- To download the validation file, place it on your website at the path specified in the settings;
- To enable the **"Apple Pay"** option.

Your site must work through **HTTPS** and **TLS 1.2** protocol for this option to be enabled successfully.

![image4](https://developers.cloudpayments.ru/en/images/image4.png)

If you use the [Checkout script](#checkout-script), you need to place ApplePay [manually](#applepayself).  
In case of using the [Widget](#payment-widget) the Apple Pay payment method will appear automatically when the Apple Pay option is enabled in the Back Office.

## Apple Pay Terms of Use

You can use the Apple Pay technology with the CloudPayments system on websites and in mobile applications, subject to Apple’s terms of use:

- You need to have an account in [Apple Developer](https://developer.apple.com/) for registration of your personal **Merchant ID** (in case of simplified integration you can get **Merchant ID** from your account manager);
- Apple Pay can not be used for tobacco products, replicas, products for adults, buying virtual currency, wallets topup payment;
- Apple Pay does not replace In-App Purchase in mobile applications;
- In case of [manual placement](#applepayself) on websites and in mobile application, you need to follow the usage guidelines by [Apple](https://developer.apple.com/apple-pay/marketing/);
- In oder to collect charitable donations, you need to register on the [Benevity](https://causes.benevity.org/causes/claim-cause-search) portal.

![image4-1](https://developers.cloudpayments.ru/en/images/image1-3.png)

## Google Pay

![image-1-1](https://developers.cloudpayments.ru/en/images/image-1-1.png)

Google Pay is a fast and easy payment method used in mobile apps and Chrome browser for all Android devices. Google Pay provides convenience of payment and safety of customer data.

Google Pay works with Visa and MasterCard cards and is available to all organizations and individual entrepreneurs working with CloudPayments system without additional agreements.

You can test payment via Google Pay in our [Demo Store](https://show.cloudpayments.ru/) (it's on Russian). Use either [test](#testing) or real card data. Money withdrawal will not occur.

## Google Pay Basics

Google Pay combines an ability to pay through the Google Pay application (previously Android Pay) in shops and a typical card payment stored in a Google user account.

If a buyer makes a payment in the app or from mobile device that supports Google Pay, he will be asked to confirm a payment in a way that depends on device capabilities.

When paying with a device without the Google Pay app, a buyer will be asked to select a saved card from his Google account and to pass [3-d Secure](#3-d-secure) authentication at the discretion of the system.

## Accepting Payments with Google Pay

### The payment scheme includes 3 stages:

- Device compatibility check. If device is supported, then you need to show the Google Pay button to a payer;
- Payment authorization. Payment confirmation by a payer;
- Payment processing. Once confirmed, Google generates an encrypted token that needs to be sent to the CloudPayments API.

## Integration

### Registration of sites and applications

For receiving payments in an application or on a website with direct integration:

1. Check that all [requirements for branding](https://developers.google.com/pay/api) are met;
2. Fill out the [registration form](https://services.google.com/fb/forms/googlepayAPIenable/), and then Google representative will contact you and instruct on further steps;
3. Be ready to send a build of an application (.apk) for verification or a link to a site with a payment page.

For taking payments through the [widget](#payment-widget) using Gpay registration and site validation are not required

## Google Pay in Mobile

Use [Google Pay API](https://developers.google.com/pay/api/android/guides/setup) to get the PaymentData value and the [payment by a cryptogram](#payment-by-a-cryptogram) method to execute a payment.

When making a request for payment data, specify a payment type through the **Wallet-Constants.PAYMENT\_METHOD\_TOKENIZATION\_TYPE\_PAYMENT\_GATEWAY** gateway and add two parameters:

1. **gateway**: cloudpayments;
2. **gatewayMerchantId**: Public ID value from CloudPayments Back Office.\`
```
PaymentMethodTokenizationParameters params =
        PaymentMethodTokenizationParameters.newBuilder()
            .setPaymentMethodTokenizationType(
                WalletConstants.PAYMENT_METHOD_TOKENIZATION_TYPE_PAYMENT_GATEWAY)
            .addParameter("gateway", "cloudpayments")
            .addParameter("gatewayMerchantId", "your Public ID")
            .build();
```

See also:

- [Example](https://github.com/cloudpayments/SDK-Android) of using Google Pay API for payment through CloudPayments;
- [Example](https://github.com/google-pay/android-quickstart) of using Google Pay API by Google.

## Google Pay in Web

There are two options for accepting Google Pay payments on your website: using the built-in features of the [widget](#payment-widget) or direct integration - that is placing a button directly on your page without additional forms. In the first case no additional integration is required. In the second case your website should be available through **HTTPS** and support the **TLS protocol version 1.2**. Site domain must be previously [registered and validated by Google](#integration).

Direct integration involves usage of a client part (javascript) and a server. On a client you can check compatibility of a device and receive payment information, and on a server you send [a payment request](#payment-by-a-cryptogram) to the API.

**Js code example:**

```
var allowedPaymentMethods = ['CARD', 'TOKENIZED_CARD'];
var allowedCardNetworks = ['MASTERCARD', 'VISA']; 
var tokenizationParameters = {
    tokenizationType: 'PAYMENT_GATEWAY',
    parameters: {
        'gateway': 'cloudpayments',
        'gatewayMerchantId': 'pk_b9fa79f3d759c56a9b856d8ac59b1' //your public id
    }
}
function getGooglePaymentsClient() {
    return (new google.payments.api.PaymentsClient({ environment: 'PRODUCTION' }));
}

// Google Pay API handler
function onGooglePayLoaded() {
    var paymentsClient = getGooglePaymentsClient();
    //device check
    paymentsClient.isReadyToPay({ allowedPaymentMethods: allowedPaymentMethods })
        .then(function (response) {
            if (response.result) {
                $('#gpay-checkout').show(); //button enable
                $('#gpay-checkout').click(onGooglePaymentButtonClicked);
            }
        });
}

//settings
function getGooglePaymentDataConfiguration() {
    return {
        merchantId: '04349806409183181471', //issued after registering with Google
        paymentMethodTokenizationParameters: tokenizationParameters,
        allowedPaymentMethods: allowedPaymentMethods,
        cardRequirements: {
            allowedCardNetworks: allowedCardNetworks
        }
    };
}

//transaction info
function getGoogleTransactionInfo() {
    return {
        currencyCode: 'RUB',
        totalPriceStatus: 'FINAL',
        totalPrice: '10.00'
    };
}

//button handler
function onGooglePaymentButtonClicked() {
    var paymentDataRequest = getGooglePaymentDataConfiguration();
    paymentDataRequest.transactionInfo = getGoogleTransactionInfo();

    var paymentsClient = getGooglePaymentsClient();
    paymentsClient.loadPaymentData(paymentDataRequest)
        .then(function (paymentData) {
            processPayment(paymentData);
        });
}            

//payment processing
function processPayment(paymentData) {
    var data = {
        cryptogram: JSON.stringify(paymentData.paymentMethodToken.token)
    };

    // send a request to your server, and then request the CloudPayments API
    // to make a payment
    $.post("/GooglePay/Pay", data).then(function (result) {
        if (result.Success) {
            //payment successful
        } else {
            if (result.Model.PaReq) { 
                //3-d secure required
            } else {
                //payment declined
            }
        }
    });
}
```

At the end of a page you need to place the script to call the Google Pay API functions:

```
<script async src="https://pay.google.com/gp/p/js/pay.js" onload="onGooglePayLoaded()"></script>
```

**See also:**

- Google Pay API [Documentation](https://developers.google.com/pay/api/web/guides/setup) for Web.
- How to [process](#obrabotka-3-d-secure) 3-d Secure.

## Google Pay Terms of Use

You can use Google Pay technology with CloudPayments on websites and mobile applications subject to the following requirements:

- You must respect [the terms of use](https://payments.developers.google.com/terms/sellertos) of Google, including:
	- [List](https://payments.developers.google.com/terms/aup) of prohibited goods and services;
		- [Branding requirements](https://developers.google.com/pay/api).
- For payments acceptance in a mobile app or when placing a GPay button on your site (as in the example above), you need to register the app and the site with Google and go through the validation process.

## Integration Scenarios

The system offers various integration options from very simple to infinitely functional depending on the requirements.

## Payment Form

If you do not need to check payments before payment and record a fact after payment:

- Add the [widget](#widget-installation) script on your site;
- Specify an email address for payment notifications in [Back Office](https://merchant.cloudpayments.ru/).

## Payment Registering

If you need to register payments in your system without pre-check, then your actions are:

- Add the [script](#installation) on your site;
- Make a payment registering:
	- Create a handler for [Pay notification](#pay), for example **https://site.ru/webhooks/cloudpayments/pay**;
		- Provide a logic of a payment registration in the handler and a response (в технической терминологии это response) in JSON format;
		- Enable the Pay notifications function in [Back Office](https://merchant.cloudpayments.ru/).

## Payment Checking and Registering

If you need to check and register payments in your system, then your actions are:

- Add the [widget](#widget-installation) script on your site;
- Make a payment checking:
	- Create a handler for [Check notification](#check), for example on, **https://site.ru/webhooks/cloudpayments/check**;
		- Provide a logic of a payment registration in the handler and a response in JSON format;
- Make a payment registering:
	- Create a handler for [Pay notification](#pay), for example on, **https://site.ru/webhooks/cloudpayments/pay**;
		- Provide a logic of a payment registration in the handler and a response in JSON format;
- Enable the Check and Pay notifications function in [Back Office](https://merchant.cloudpayments.ru/).

## Recurrent Payments for ISP's

The payment solution is suitable for Internet providers, telecom operators, and telecoms. The notifications for checking and registering payments can be configured both in CloudPayments format and in QIWI format (OSMP).

<iframe src="https://developers.cloudpayments.ru/en/pages/widget.html" width="100%" height="630px" align="baseline" frameborder="1"></iframe>

**Code:**

```
this.paySample3 = function () {
    var widget = new cp.CloudPayments();

    var data = {};
    var auto = $('#recurrent-sample-3').is(':checked'); //checking

    if (auto) { //enabling the subscription

        var date = new Date(); //current date
        date.setMonth(date.getMonth() + 1); //next month
        date.setDate(date.getDate() - 1); //minus one day

        var recurrent = { interval: 'Month', period: 1, startDate: date }; //once a month starting from the next month minus one day

        data.cloudPayments = {
            recurrent: recurrent
        }
    }

    var amount = parseFloat($('#amount-sample-3').val());
    var accountId = $('#account-sample-3').val();

    widget.charge({ // options
        publicId: 'test_api_00000000000000000000002', //id from Back Office
        description: 'Top up the account number ' + accountId, //purpose/justification
        amount: amount, 
        currency: 'RUB', 
        accountId: accountId, //Payer's ID (required for subscription)
        data: data
    },
    function (options) { // success
        //action upon successful payment
    },
    function (reason, options) { // fail
        //action upon unsuccessful payment
    });
};

$('#checkout-sample-3').click(paySample3);
```

## Recurrent Payments for Charities

The payment solution is suitable for charitable foundations. The name, surname, phone number, e-mail, and any other form data will be saved in the widget and transferred to your server via [Pay notification](#pay).

<iframe src="https://developers.cloudpayments.ru/en/pages/widget2.html" width="100%&quot;" height="800px" align="baseline" frameborder="1"></iframe>

**Code:**

```
this.paySample4 = function () {
    var widget = new cp.CloudPayments();

    var data = { //donator data
        name: $('#name-sample-4').val(),
        lastName: $('#lastName-sample-4').val(),
        phone: $('#phone-sample-4').val()
    };

    var auto = $('#recurrent-sample-4').is(':checked'); //check

    if (auto) { //enabling the subscription
        data.cloudPayments = {
            recurrent: { interval: 'Month', period: 1 } //once a month starting the next month
        }
    }

    var amount = parseFloat($('#amount-sample-4').val());
    var accountId = $('#email-sample-4').val();

    widget.charge({ // options
        publicId: 'test_api_00000000000000000000002', //id from Back Office
        description: 'Donation to a fund ...', //purpose
        amount: amount, 
        currency: 'RUB', 
        accountId: accountId, //Payer's ID (required for subscription)
        email: accountId,
        data: data
    },
    function (options) { // success
        //action upon successful payment
    },
    function (reason, options) { // fail
        //action upon unsuccessful payment
    });
};

$('#checkout-sample-4').click(paySample4);
```

## Payment by Installments

The payment solution is suitable for companies selling goods and services with the possibility of payment by installments.

<iframe src="https://developers.cloudpayments.ru/en/pages/widget3.html" width="100%&quot;" height="530px" align="baseline" frameborder="1"></iframe>

**Code:**

```
this.paySample5 = function () {
    var widget = new cp.CloudPayments();

    var amount = 12000; //by default 12,000 rubles at once
    var data = {};

    var payLater = $('#select-sample-5-later').is(':checked'); //check

    if (payLater) { //enabling the subscription
        data.cloudPayments = {
            recurrent: { interval: 'Month', period: 1, amount: 1000, maxPeriods: 6 } //6 months for 1000 rubles starting the next month
        };
        amount = 6000; //The amount of the first payment is 6000 rubles.
    }

    widget.charge({ // options
        publicId: 'test_api_00000000000000000000002', //id from Back Office
        description: 'Payment ...', //purpose
        amount: amount, 
        currency: 'RUB', 
        accountId: 'user@example.com', //Payer's ID (required for subscription)
        data: data
    },
    function (options) { // success
        //action upon successful payment
    },
    function (reason, options) { // fail
        //action upon unsuccessful payment
    });
};

$('#checkout-sample-5').click(paySample5);
```

## Regular recurrent payments

If you need to charge a fee from your customers on a regular basis according to a schedule, the scenario may be also as follows:

- Your site requires an authorization of users with the access to their personal account.
- Before creating a subscription plan, inform a user about the rates, the frequency of payments, and offer him or her to specify the card data.

![recurring1](https://developers.cloudpayments.ru/en/images/recurrent.jpeg)

- In accordance with your business process, make authorization for 1 ruble to check the card or make pay for the amount of the first subscription period.
- Get a card token via any API payment method or [Pay notification](#pay) and [create a recurrent payment plan](#creation-of-subscriptions-on-recurrent-payments).
- Subscribe to [Fail](#fail) and [Recurrent](#reccurent) notifications. Inform a user that he needs to check the card after receiving the notification of unsuccessful payment. At the end of the subscription or cancellation, complete the provision of services.
- Make a section with payment history, which includes at least a date and a payment amount.

## One Click Payment(Recurring)

If you need to save the card data on the payment gateway side for further payment in one click without entering the card data and without 3-D Secure, the scenario may be as follows:

- Your site requires authorization of users with access to their personal account.
- During the first payment, ask a payer to bind a card.

![1cl-1](https://developers.cloudpayments.ru/en/images/1cl-1.jpeg)

If the user agrees, save the card mask (a type and the last 4 digits) and the token after the payment in his profile. The card and the token parameters are returned by the system in [Pay](#pay) notifications and in API payment response.

- For further payments, offer the user to pay with the previously attached card.

![1cl-2](https://developers.cloudpayments.ru/en/images/1cl-2.jpeg)

If the user selects the previously used card, call the [payment method by a token](#payment-by-a-token-recurring) via the API.

- Provide the user an ability to manage his or her cards.

![1cl-3](https://developers.cloudpayments.ru/en/images/1cl-3.jpeg)

If the user does not want to pay with the attached card anymore, remove the mask and the token from his or her profile.

- Make a section with payment history, which includes at least a date and a payment amount.

## PCI DSS

PCI DSS is an information security standard developed for payment card industry for organizations that handle branded cards (Visa and MasterCard). All the companies that accept cards for payment must be in compliance with this standard. Some of them need to confirm their compliance.

## Compliance with the Requirements

The main requirement of the standard is to limit access to payment card data as much as possible. The best solution is not to have access to them at all, and instead use certified providers to receive payments. In practice, that means that either requesting or sending card numbers is prohibited. If a customer says that the payment failed and starts dictating card number, her or she must be interrupted. If a customer sent card number by mail or in other messengers it must be deleted and a customer must be asked no longer do so.

The protected data includes a full card number and CVV2 / CVC2 code (the last 3 digits on the back side). An owner's name, an expiration date and a masked card number (the first 6 and last 4 digits) do not need to be protected according to the requirements of the standard so they can be used within reasonable limits.

## PCI DSS Compliance with CloudPayments

CloudPayments is a certified service provider with the highest level of PCI DSS compliance, granting the right to store payment card data and process more than 6 million payments annually. Confirmation of compliance takes place every year as a part of a certification audit.

All CloudPayments payment tools are designed in such a way that when you use them, you automatically meet the security requirements. No need to take additional measures.

An exception is the acceptance of payments using the [Checkout](#checkout-script) technology. It is necessary to confirm compliance when using it: fill out a self-assessment sheet and quarterly check the site for vulnerabilities with a special scanner.

## Checkout Technology

[Checkout](#checkout-script) is a unique tokenization card technology for accepting payments on your website and in your form without embedded iframe elements, which gives maximum control and conversion of payments. Payment card data is encrypted in the buyer's browser, so your site is not involved in the processing and storage of card numbers, which significantly reduces the scope of application of PCI DSS requirements. However, site affects the security of card data and it is necessary to perform a scan at least once a quarter for searching viruses and vulnerabilities on order to protect it. Scanning must be done by an accredited vendor (ASV) from the list provided on the PCI Council website.

## ASV Scan

ASV Scan is an automated scan of your site for vulnerabilities. The scanner checks for viruses, known vulnerabilities, such as XSS, SQL Injections, and so on, and then compiles a detailed report with instructions on how to fix problems if they were detected.

The use of the scanner is necessary for receiving payments using the [Checkout](#checkout-script) technology; for other tools such as widget, mobile SDK, recurring,and recurrent it is not required.

The choice of vendor for scanning remains at your discretion, but it must be from the [list on the PCI website](https://www.pcisecuritystandards.org/approved_companies_providers/approved_scanning_vendors) . If you have no preferences, we recommend to use Trustwave - an international company, a recognized leader in information security.

## Instructions for Trustwave ASV scanner

The annual cost of the package of services is $ 499 and includes a subscription to the scan, assistance in completing the self-assessment sheet, training materials, and security policy.

**You need to:**

- Register at [https://pci.securetrust.com/pci](https://pci.securetrust.com/pci) (with the Get Started button). During registration, you will need to specify Merchant ID, for clarification contact your manager or email to **support@cloudpayments.ru**.
- Specify that you accept payments on your site.
- Specify the option “My Website”.
- Pay $ 499 (cards only).
- Set your site’s IP address and schedule for scanning.

## Online Cash Register

## Federal Act №54

The Federal Act №54 on The Use of Cash Registers as amended on 3 July 2016 requires Internet services to use cash registers and send online-receipts to a buyer at the time of calculation when making electronic payments (including bank cards).

## Law Basics

- It is necessary to use a cash register of the new model (online) with a fiscal memory device installed.
- It is necessary to have an agreement with a fiscal data [operator for online](#fiscal-data-operators) data transfering from Cash Register Equipment.
- It is necessary to specify all fields for commodity items in online receipts: name, price, quantity, amount, VAT rate.
- It is necessary to connect Cash Register Equipment to the Internet.
- It is necessary to issue a receipt to a buyer directly at the time of payment. In case of Internet payments via a bank card a receipt must be sent to an e-mail or a phone.
- It is necessary to change a fiscal memory device in two cases:
	- upon its expiration;
		- when memory is full before the expiration date;  
		and keep it for 5 years.
- There is no need to enter into an agreement with the Cash Register's Service Center.
- There is no need to present a cash register to an inspector of the Federal Tax Service, all the registration actions can be performed remotely in a personal account of a taxpayer on the website of the Federal Tax Service.

## Online Fiscalization

CloudPayments offers its partners a cloud solution for online fiscalization of Internet payments and within the Federal Law №54 for any business you will obtain:

- Dedicated cash register, registered in the FTS to your company.
- Fiscal memory device.
- Fiscal data operator connectivity.
- Automatic generation of online-receipts at the time of the calculation.
- Full report on transactions in Back Office.

The Cash Register will be placed in the data center 24/7 with the Internet and power connections, working around the clock and without interruptions. Our employees will monitor its technical condition and timely change fiscal memory devices. Special software will correct errors, open and close shifts on a schedule, put receipts on the queue in the cloud and reliably send them to customers.

![cloud-scheme](https://developers.cloudpayments.ru/en/images/cloud-scheme.png)

## Cash Register

We use "MicroPay-FAS" and "MicroPay-FS" cash registers with the connection to any [fiscal data operator](#fiscal-data-operators).

![cash_registers](https://developers.cloudpayments.ru/en/images/cash_registers.jpeg)

## Technology Demonstration

The example of payment by a card with automatic receipt generation and sending to an e-mail or a phone.

<iframe src="https://developers.cloudpayments.ru/en/pages/cash_register_demo.html" width="100%&quot;" height="550px" align="baseline" frameborder="1"></iframe>

[The example](https://developers.cloudpayments.ru/pages/cash_register_demo.html)

of payment by a card with automatic receipt generation and sending to an e-mail or a phone.

### Price

You can know the price of online fiscalization and maintenance services on the [CloudKassir](https://cloudkassir.ru/) website and/or contact your account manager.

## Onboarding Procedure

To activate the online fiscalization service, you should:

- Conclude a treaty on online fiscalization with CloudKassir.
- Get a qualified electronic signature to work with the FTS website.
- Sign in a personal account of the tax service: — for legal entities — for individual entrepreneurs
- Integrate CloudKassir API with your service.

After signing the contract and paying the bill, you will get a Cash Register and a fiscal memory devices number for registration with in Federal Tax Service.

## Online Receipt Format for Payment Methods

Receipt data must be sent in json format as shown below:

```
var receipt = {
            "Items": [//commodity items
                {
                    "label": "Product №1", //item name
                    "price": 100.00, 
                    "quantity": 1.00, 
                    "amount": 100.00, 
                    "vat": 0, //vat rate
                    "method": 0, // tag-1214 sign of the calculation method
                    "object": 0, // tag-1212 sign of the calculation object - sign of the calculation object, work, service, payment, payout, or another calculation object
                    "measurementUnit": "шт" 
                }, {
                    "label": "Product №2", //item name
                    "price": 200.00, 
                    "quantity": 2.00, 
                    "amount": 300.00, //amount with 25% discount
                    "vat": 10, //vat rate
                    "method": 0, // tag-1214 sign of the calculation method
                    "object": 0, // tag-1212 sign of the calculation object - sign of the calculation object, work, service, payment, payout, or another calculation object
                    "measurementUnit": "шт",
                    "excise": 0.01, // tag-1229 excise amount
                    "countryOriginCode": "156", // tag-1230 digital code of the goods origin country in accordance with the National country classification in 3 characters
                    "customsDeclarationNumber": "54180656/1345865/3435625/23" // tag-1231 customs declaration registration number 32 characters
                    "ProductCodeData": //product labeling data
                            {
                            "CodeProductNomenclature":"3031303239303030303033343....a78495a4f6672754744773d3d" //full HEX of marking barcode (Only for Micropay cash registers)
                            }
                }, {
                        "label": "Product №3", //item name
                        "price": 300.00, 
                        "quantity": 3.00,
                        "amount": 900.00, 
                        "vat": 20, //vat rate
                        "method": 0, // tag-1214 sign of the calculation method
                        "object": 0, // tag-1212 sign of the calculation object - sign of the calculation object, work, service, payment, payout, or another calculation object
                        "measurementUnit": "шт", 
                        "AgentSign": 6, // tag OFD 1057, 1222
                        "AgentData": { //tag OFD 1223
                            "AgentOperationName": null, // name of the operation of the bank payment agent or bank payment subagent, tag OFD 1044
                            "PaymentAgentPhone": null,  //  payment agent telephone, tag OFD 1073
                            "PaymentReceiverOperatorPhone": null, // tag OFD 1074
                            "TransferOperatorPhone": null, // tag OFD 1075
                            "TransferOperatorName": null, // tag OFD 1026
                            "TransferOperatorAddress": null, // tag OFD 1005
                            "TransferOperatorInn": null // tag OFD 1016
                        },
                        "PurveyorData": { //tag OFD 1224
                            "Phone": "+74951234567", // tag OFD 1171
                            "Name": "ООО Ромашка", // tag OFD 1225
                            "Inn": "1234567890" // tag OFD 1226
                        }
                    }
            ],
            "calculationPlace": "www.my.ru", //calculation place, by default taken from the cash register
            "taxationSystem": 0, //optional, if you have one taxation system
            "email": "user@example.com", //buyer's e-mail , if you need to send a email with the receip
            "phone": "", //buyer's phone number in free format, if you need to send a link on the receipt via SMS
            "customerInfo": "", // tag-1227 Buyer's organisation name or name, middlename(if available), surname and passport data (of buyer)
            "customerInn": "7708806063", // tag-1228 TIN of the buyer  
            "isBso": false, //if receipt is a form of strict accountability
            "AgentSign": null, // tag OFD 1057
            "amounts":
            {
                "electronic": 1300.00, // the amount of payment by electronic money
                "advancePayment": 0.00, // prepayment amount (offset of advance payment) (2 decimal places)
                "credit": 0.00, // postpay amount (on credit) (2 decimal places)
                "provision": 0.00 // the amount of payment by the reciprocal grant (certificates, other physical values) (2 decimal places)
            }
        }

var data = { //the contents of the data element
    "cloudPayments": {
      "customerReceipt": receipt, //online-receipt
    }
}
```

Details of **СustomerReceipt** object you may see in documentation of [Cloudpayments](https://developers.cloudkassir.ru/en/#online-receipt-generation%20target=)

## Terms and Conditions of Online-Receipt Generation

- Receipt has at least one position;
- Name is specified in all positions;
- Price and amount of a position is not negative;
- The total sum of all items is greater than zero;
- Product name length is not more than 128 characters, longer names will be truncated;
- Specified tax system should match one of the options registered in a Cash Register;
- Numeric values are with an accuracy of no more than two decimal places;

Data for an online receipt can be transferred to the [widget parameters](#parameters), with [payment by a cryptogram](#payment-by-a-cryptogram) or [by a token](#payment-by-a-token-recurring), with [payment confirmation](#payment-confirmation), when [making a refund](#refund), and also through special [CloudKassir API(En)](https://developers.cloudkassir.ru/en/#api).

## Receipt Types and Settlement signs

When transferring online receipt data to the widget or payment methods, the system generates 2 receipt types in automatic mode:

- Receipt with the Settlement sign **Income** during the payment transaction.
- Receipt with the Settlement sign **Income return** during the refund operation.

## Sending Receipt to Customer

Online receipt must be sent by e-mail or SMS (Viber / WhatsApp / Telegram) message to a phone number according to customer preferences. Receipt can be sent by CloudPayments system automatically if customer provided an e-mail or a phone number, or customer can send a receipt manually as soon as the system passes all the necessary details in the [Receipt](https://developers.cloudkassir.ru/en/#receipt) notification about generated receipts.

## Moment of Receipt Sending

Receipt must be sent to a customer at the time of the settlement. For [Single message scheme](#payment-schemes) payment a receipt is generated immediately when a payment is completed, for [dual message scheme](#payment-schemes) payments a receipt is generated when confirming an operation.

## Online Receipt Testing

When working in test mode, cash receipts will be generated in a demo Cash Register with a debug fiscal drive. You can transfer [data for an online receipt](#online-receipt-format-parameters) when paying in test mode and check an operation of online cash register.

## Testing

Once you have an access to Back Office, it is in a test mode already which means that payments and other operations will take place in emulation mode.

For testing, you can use the following card data:

| Type | Card Number | Payment result | Payment result by Token |
| --- | --- | --- | --- |
| Card Visa with 3-D Secure | 4242 4242 4242 4242 | Successful result | Successful result |
| Card MasterCard with 3-D Secure | 5555 5555 5555 4444 | Successful result | Successful result |
| Card Visa with 3-D Secure | 4012 8888 8888 1881 | Insufficient funds | — |
| Card MasterCard with 3-D Secure | 5105 1051 0510 5100 | Insufficient funds | — |
| Card Visa without 3-D Secure | 4111 1111 1111 1111 | Successful result | Insufficient funds |
| Card MasterCard without 3-D Secure | 5200 8282 8282 8210 | Successful result | Insufficient funds |
| Card Visa without 3-D Secure | 4000 0566 5566 5556 | Insufficient funds | — |
| Card MasterCard without 3-D Secure | 5404 0000 0000 0043 | Insufficient funds | — |

## Apple Pay Testing

In test mode, the system accepts payments with any card binded to [Apple Pay](#apple-pay) for less than 10,000 rubles with a successful result (but does not charge money) and rejects payments in excess of 10,000 rubles with the "Insufficient funds" error.

## Online Cash Register Testing

When operating in test mode, cash receipts will be generated in a test online cash register with a debug fiscal drive. Test online cash registers are disabled by default. To enable it please contact your manager or email to support@cloudpayments.ru.

## Reference

## Error Codes

You can see the error codes below that determine the reason of payment rejection.

The payment widget displays an error message automatically. In API it is represented by the **CardHolderMessage** parameter.

| Code | Name | Reason | Message for payer |
| --- | --- | --- | --- |
| 5001 | Refer To Card Issuer | Issuer declined the operation | Contact your bank or use another card |
| 5003 | Invalid Merchant | Issuer declined the operation | Contact your bank or use another card |
| 5004 | Pick Up Card | Lost Card | Contact your bank or use another card |
| 5005 | Do Not Honor | Issuer declined without explanation   `- CVV code is incorrect for MasterCard;`   `- Issuer Bank internal limitations;`   `- card is locked or not  activated yet;`   `- card is not allowed for online payments or has no 3-D secure.` | Contact your bank or use another card |
| 5006 | Error | Network failure to perform an operation or incorrect CVV code | Check the correctness of entered card data or use another card |
| 5007 | Pick Up Card Special Conditions | Lost Card | Contact your bank or use another card |
| 5012 | Invalid Transaction | The card is not intended for online payments | Contact your bank or use another card |
| 5013 | Amount Error | Too small or too large transaction amount | Check the correctness of the amount |
| 5014 | Invalid Card Number | Invalid Card Number | Check the correctness of entered card data or use another card |
| 5015 | No Such Issuer | Unknown card issuer | Use another card |
| 5019 | Transaction Error | Issuer declined without explanation   `- CVV code is incorrect for MasterCard;`   `- Issuer Bank internal limitations;`   `- card is locked or not  activated yet;`   `- card is not allowed for online payments or has no 3-D secure.` | Contact your bank or use another card |
| 5030 | Format Error | Error on the side of the acquirer - incorrectly formed transaction | Try again later |
| 5031 | Bank Is Not Supported By Switch | Unknown card issuer | Use another card |
| 5033 | Expired Card Pickup | Expired Card Pickup | Contact your bank or use another card |
| 5034 | Suspected Fraud | Issuer failure - fraud is suspected | Contact your bank or use another card |
| 5036 | Restricted Card | The card is not intended for online payments | Contact your bank or use another card |
| 5041 | Lost Card | Lost Card | Contact your bank or use another card |
| 5043 | Stolen Card | Stolen Card | Contact your bank or use another card |
| 5051 | Insufficient Funds | Insufficient Funds | Insufficient Funds |
| 5054 | Expired Card | Card is expired or expiration date is incorrect | Check the correctness of entered card data or use another card |
| 5057 | Transaction Is Not Permitted | Card limitation   `— internal limitations of Issuer`   `— card is locked or not activated yet;`   `— card is not allowed for online payments or has no 3-D secure.` | Contact your bank or use another card |
| 5062 | Restricted Card 2 | The card is not intended for online payments | Contact your bank or use another card |
| 5063 | Security Violation | The card is blocked by security violation | Use another card |
| 5065 | Exceed Withdrawal Frequency | Card transactions limit is exceeded | Contact your bank or use another card |
| 5082 | Incorrect CVV | Incorrect CVV code | Incorrect CVV code |
| 5091 | Timeout | Issuer is not available | Try again later or use another card |
| 5092 | Cannot Reach Network | Issuer is not available | Try again later or use another card |
| 5096 | System Error | Acquiring bank or network error | Try again later |
| 5204 | Unable To Process | The operation cannot be processed for other reasons | Contact your bank or use another card |
| 5206 | Authentication failed | 3-D secure Authentication failed | Contact your bank or use another card |
| 5207 | Authentication unavailable | 3-D secure Authentication unavailable | Contact your bank or use another card |
| 5300 | Anti Fraud | Acquirer Transaction Limits | Use another card |

## Check notitifcation processig responses

You can see the codes below how system registers your replies on check notification.

| Code | Name | Reason |
| --- | --- | --- |
| 3001 | InvalidInvoiceId | Callback handler returned `{"code":10}` |
| 3002 | InvalidAccountId | Callback handler returned `{"code":11}` |
| 3003 | InvalidAmount | Callback handler returned `{"code":12}` |
| 3004 | OutOfDate | Callback handler returned `{"code":20}` |
| 3005 | FormatError | Callback handler returned a different code from [expected](#check) |
| 3006 | Unavailable | Service unavailable |
| 3007 | UnableToConnect | Unable to connect (`404`, `504`, `508` и т.д) |
| 3008 | NotAccepted | Callback handler returned `{"code":13}` |

## Operation Types

The following table presents codes of operation types in notifications.

| Code | Name |
| --- | --- |
| Payment | Payment |
| Refund | Refund |
| CardPayout | Card payout |

## Transaction Statuses

The following table presents transaction statuses, conditions of use, and possible actions.

| Status | Description | Use | Possible actions |
| --- | --- | --- | --- |
| AwaitingAuthentication | Awaiting Authentication | When a payer is visiting an issuer's website while waiting for 3-D Secure results | No actions |
| Authorized | Authorized | When authorized | Confirm, Cancel |
| Completed | Completed | When operation is confirmed | Refund |
| Cancelled | Cancelled | In case of cancellation of operation | No actions |
| Declined | Declined | In case of failure to complete transaction (Insufficient Funds, etc) | No actions |

## Subscription Statuses (Recurrents)

The following table presents subscription statuses, usage conditions, and possible actions.

| Status | Description | Use | Possible actions |
| --- | --- | --- | --- |
| Active | Subscription is active | When subscription is created and/or payment by subscription is done | Cancel |
| PastDue | Subscription is expired | After one or two consecutive unsuccessful payment attempts | Cancel |
| Cancelled | Cancelled | In case of cancellation upon request | No actions |
| Rejected | Rejected | In the case of three unsuccessful back-to-back payment attempts | No actions |
| Expired | Done | In case of completion of the maximum number of periods (if specified) | No actions |

## Currency List

Our partners accept payments in rubles, US dollars, euros, pound sterling, and 54 other currencies of the world.

The following table presents the names of the currencies and their codes which can be assigned to the **currency** parameter of the [Widget](#payment-widget) or [API](#api).

| Name | Code |
| --- | --- |
| Russian ruble | RUB |
| Euro | EUR |
| US dollar | USD |
| Pound sterling | GBP |
| Ukrainian hryvnia | UAH |
| Belarusian ruble (not applicable since the 1st of July 2016) | BYR |
| Belarusian ruble | BYN |
| Kazakh tenge | KZT |
| Azerbaijani manat | AZN |
| Swiss frank | CHF |
| Czech koruna | CZK |
| Canadian dollar | CAD |
| Polish zloty | PLN |
| Swedish crown | SEK |
| Turkish lira | TRY |
| Chinese yuan | CNY |
| Indian rupee | INR |
| Brazilian real | BRL |
| South african rand | ZAR |
| Uzbek sum | UZS |
| Bulgarian lev | BGN |
| Romanian leu | RON |
| Australian dollar | AUD |
| Hong Kong dollar | HKD |
| Georgian lari | GEL |
| Kyrgyzstani som | KGS |
| Armenian dram | AMD |
| United Arab Emirates dirham | AED |

If the currency you need is not listed, email us at support@cloudpayments.ru and we will update the list.

## Timezone Codes

The table below contains time zone codes for time conversion.

| Code | Description |
| --- | --- |
| HST | (UTC-10:00) Hawaii |
| AKST | (UTC-09:00) Alaska |
| PST | (UTC-08:00) Pacific Time (US and Canada) |
| MST | (UTC-07:00) Mountain time (USA and Canada) |
| CST | (UTC-06:00) Central time (USA and Canada) |
| EST | (UTC-05:00) Eastern time (USA and Canada) |
| AST | (UTC-04:00) Atlantic Time (Canada) |
| BRT | (UTC-03:00) Brazil |
| UTC | (UTC) UTC Format |
| GMT | (UTC) Dublin, Lisbon, London, Edinburgh |
| CET | (UTC+01:00) Amsterdam, Berlin, Bern, Vienna, Rome, Stockholm |
| CET | (UTC+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague |
| CET | (UTC+01:00) Brussels, Copenhagen, Madrid, Paris |
| CET | (UTC+01:00) Warsaw, Zagreb, Sarajevo, Skopje |
| EET | (UTC+02:00) Athens, Bucharest |
| EET | (UTC+02:00) Vilnius, Kiev, Riga, Sofia, Tallinn, Helsinki |
| EET | (UTC+02:00) Eastern Europe |
| EET | (UTC+02:00) Kaliningrad (RTZ 1) |
| MSK | (UTC+03:00) Volgograd, Moscow, St. Petersburg (RTZ 2) |
| MSK | (UTC+03:00) Minsk |
| AZT | (UTC+04:00) Baku |
| AMT | (UTC+04:00) Yerevan |
| SAMT | (UTC+04:00) Izhevsk, Samara (RTZ 3) |
| GET | (UTC+04:00) Tbilisi |
| TJT | (UTC+05:00) Ashgabat, Tashkent |
| YEKT | (UTC+05:00) Yekaterinburg (RTZ 4) |
| ALMT | (UTC+06:00) Astana, Almaty |
| NOVT | (UTC+06:00) Novosibirsk (RTZ 5) |
| KRAT | (UTC+07:00) Krasnoyarsk (RTZ 6) |
| HKT | (UTC+08:00) Hong Kong, Beijing, Urumqi, Chongqing |
| IRKT | (UTC+08:00) Irkutsk (RTZ 7) |
| SGT | (UTC+08:00) Kuala Lumpur, Singapore |
| ULAT | (UTC+08:00) Ulaanbaatar |
| YAKT | (UTC+09:00) Yakutsk (RTZ 8) |
| VLAT | (UTC+10:00) Vladivostok, Magadan (RTZ 9) |
| SAKT | (UTC+11:00) Chokurdah (RTZ 10) |
| ANAT | (UTC+12:00) Anadyr, Petropavlovsk-Kamchatsky (RTZ 11) |

## Notification Types

The table below contains the types of notifications.

| Code | Name |
| --- | --- |
| Check | [Check](#check) |
| Pay | [Pay](#pay) |
| Fail | [Fail](#fail) |
| Confirm | [Confirm](#confirm) |
| Refund | [Refund](#refund) |
| Recurrent | [Recurrent](#recurrent) |
| Cancel | [Cancel](#cancel) |

[Example](#)