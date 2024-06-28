import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { XummService } from './services/xumm.service'
import { XRPLWebsocket } from './services/xrplWebSocket';
import { Observable, Subject, Subscription } from 'rxjs';
import { GenericBackendPostRequest, TransactionValidation } from './utils/types';
import * as flagUtil from './utils/flagutils';
import { MatStepper } from '@angular/material/stepper';
import * as normalizer from './utils/normalizers';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { XummTypes } from 'xumm-sdk';
import { TypeWriter } from './utils/TypeWriter';
import * as clipboard from 'copy-to-clipboard';

@Component({
  selector: 'createToken',
  templateUrl: './createToken.html',
  styleUrls: ['./createToken.css']
})
export class CreateToken implements OnInit, OnDestroy {

  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;
  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;
  private ACCOUNT_FLAG_DISABLE_INCOMING_XRP:number = 3;

  constructor(
    private xummApi: XummService,
    private snackBar: MatSnackBar,
    private overlayContainer: OverlayContainer,
    private xrplWebSocket: XRPLWebsocket) { }

  checkBoxTwoAccounts:boolean = false;
  checkBoxIssuerInfo:boolean = false;
  checkBoxSufficientFunds:boolean = false;
  checkBoxFiveXrp:boolean = false;
  checkBoxNetwork:boolean = false;
  checkBoxNoLiability:boolean = false;
  checkBoxDisclaimer:boolean = false;
  checkBoxDisclaimer2:boolean = false;

  checkBoxBlackhole1:boolean = false;
  checkBoxBlackhole2:boolean = false;
  checkBoxBlackhole3:boolean = false;
  checkBoxBlackhole4:boolean = false;
  checkBoxBlackhole5:boolean = false;

  checkBoxIssuingText:boolean = false;

  blackholeDisallowXrp:boolean = false;
  blackholeRegularKeySet:boolean = false;
  blackholeMasterDisabled:boolean = false;

  checkBoxAccountsPreselected:boolean = false;

  checkBoxFeeBurned:boolean = false;

  issuer_account_info:any = null;
  recipient_account_info:any;
  isTestMode:boolean = false;

  issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;
  signInAccount:string;

  currencyCode:string;
  limit:string;
  validCurrencyCode:boolean = false;
  currencyAlreadyIssued:boolean = false;
  validLimit:boolean = false;
  isNft:boolean = false;
  kycAccount:string = null;
  accountHasKYC:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentSuccessfull:boolean = false;
  paymentChecked:boolean = false;
  paymentFound:boolean = false;
  paymentStarted:boolean = false;

  needDefaultRipple:boolean = true;
  recipientTrustlineSet:boolean = false;
  weHaveIssued:boolean = false;

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  @Input()
  ottChanged: Observable<any>;

  @Input()
  themeChanged: Observable<any>;

  private ottReceived: Subscription;
  private themeReceived: Subscription;

  themeClass = 'dark-theme';
  backgroundColor = '#000000';

  loadingData:boolean = false;

  infoLabel:string = null;
  infoLabel2:string = null;
  infoLabel3:string = null;

  errorLabel:string = null;

  memoInput: string;
  alreadyIssuedCurrencies:string[] = [];
  hasOutgoingTrustlines:boolean = false;

  title: string = "XRPL Services xApp";
  tw: TypeWriter

  termsAndConditions:boolean = false;

  fixAmounts:any = null;

  loadingAccountTransactions:boolean = false;

  @ViewChild('stepper') stepper: MatStepper;

  async ngOnInit(): Promise<void> {

    this.loadingData = true;

    /**
    await this.loadAccountDataIssuer("rnvNg8HMZbgzSXvsELaVdjvmjF5puHzPyB");
    this.issuerAccount = "rnvNg8HMZbgzSXvsELaVdjvmjF5puHzPyB";
    this.signInAccount = "rnvNg8HMZbgzSXvsELaVdjvmjF5puHzPyB";
    this.loadingData = false;
     */

    this.ottReceived = this.ottChanged.subscribe(async ottData => {
      this.infoLabel = "ott received: " + JSON.stringify(ottData);
      //console.log("ottReceived: " + JSON.stringify(ottData));

      if(ottData) {

        this.fixAmounts = await this.xummApi.getFixAmounts();

        this.infoLabel = JSON.stringify(ottData);
        
        this.isTestMode = ottData.nodetype != 'MAINNET';
        //this.isTestMode = true;

        this.infoLabel2 = "changed mode to testnet: " + this.isTestMode;

        if(ottData && ottData.account && ottData.accountaccess == 'FULL') {
          this.issuerAccount = ottData.account;
          await this.loadAccountDataIssuer(this.issuerAccount);
          this.loadingData = false;

          //await this.loadAccountData(ottData.account); //false = ottResponse.node == 'TESTNET' 
        } else {
          this.issuer_account_info = "no account";
          this.loadingData = false;
        }

        this.infoLabel = JSON.stringify(this.issuer_account_info);
      }

      //this.testMode = true;
      //await this.loadAccountData("rELeasERs3m4inA1UinRLTpXemqyStqzwh");
      //await this.loadAccountData("r9N4v3cWxfh4x6yUNjxNy3DbWUgbzMBLdk");
    });

    this.themeReceived = this.themeChanged.subscribe(async appStyle => {

      //this.infoLabel2 = JSON.stringify(appStyle);

      this.themeClass = appStyle.theme;
      this.backgroundColor = appStyle.color;

      var bodyStyles = document.body.style;
      bodyStyles.setProperty('--background-color', this.backgroundColor);
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.remove('light-theme');
      this.overlayContainer.getContainerElement().classList.remove('moonlight-theme');
      this.overlayContainer.getContainerElement().classList.remove('royal-theme');
      this.overlayContainer.getContainerElement().classList.add(this.themeClass);
    });
    //this.infoLabel = JSON.stringify(this.device.getDeviceInfo());

    await this.loadFeeReserves();

    this.tw = new TypeWriter(["XRPL Services xApp", "created by nixerFFM", "XRPL Services xApp"], t => {
      this.title = t;
    })

    this.tw.start();
  }

  ngOnDestroy() {
    if(this.ottReceived)
      this.ottReceived.unsubscribe();

    if(this.themeReceived)
      this.themeReceived.unsubscribe();
  }

  async loadFeeReserves() {
    let fee_request:any = {
      command: "ledger_entry",
      index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
      ledger_index: "validated"
    }

    let feeSetting:any = await this.xrplWebSocket.getWebsocketMessage("fee-settings", fee_request, this.isTestMode);
    this.accountReserve = feeSetting?.result?.node["ReserveBase"];
    this.ownerReserve = feeSetting?.result?.node["ReserveIncrement"];

    //console.log("resolved accountReserve: " + this.accountReserve);
    //console.log("resolved ownerReserve: " + this.ownerReserve);
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  async waitForTransactionSigning(payloadRequest: GenericBackendPostRequest): Promise<any> {
    this.loadingData = true;
    //this.infoLabel = "Opening sign request";
    let xummResponse:XummTypes.XummPostPayloadResponse;
    try {
        payloadRequest.payload.options = {
          expire: 2
        }

        if(payloadRequest.payload.txjson.Account && isValidXRPAddress(payloadRequest.payload.txjson.Account+"")) {
          payloadRequest.payload.options.signers = [payloadRequest.payload.txjson.Account+""]
        }

        //console.log("sending xumm payload: " + JSON.stringify(xummPayload));
        xummResponse = await this.xummApi.submitPayload(payloadRequest);
        //this.infoLabel = "Called xumm successfully"
        //this.infoLabel = (JSON.stringify(xummResponse));
        if(!xummResponse || !xummResponse.uuid) {
          this.snackBar.open("Error contacting XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          return null;
        }        
    } catch (err) {
        //console.log(JSON.stringify(err));
        this.snackBar.open("Could not contact XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        return null;
    }

    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'openSignRequest',
        uuid: xummResponse.uuid
      }));
    }

    //this.infoLabel = "Showed sign request to user";

    try {

      return new Promise( async (resolve, reject) => {

        //use event listeners over websockets
        if(typeof window.addEventListener === 'function') {
          window.addEventListener("message", event => {
            try {
              if(event && event.data) {
                let eventData = JSON.parse(event.data);
        
                console.log("WINDOW: " + eventData);

                if(eventData && eventData.method == "payloadResolved") {

                  window.removeAllListeners("message");

                  if(typeof document.addEventListener === 'function') {
                    document.removeAllListeners("message");
                  }

                  if(eventData.reason == "SIGNED") {
                    //create own response
                    let message = {
                      signed: true,
                      payload_uuidv4: eventData.uuid
                    }
                    
                    resolve(message);

                  } else if(eventData.reason == "DECLINED") {
                    //user closed without signing
                    resolve(null)
                  }
                }
              }
            } catch(err) {
              //ignore errors
            }
          });
        }

        //use event listeners over websockets
        if(typeof document.addEventListener === 'function') {
          document.addEventListener("message", event => {
            try {
              let anyEvent:any = event;
              if(anyEvent && anyEvent.data) {
                let eventData = JSON.parse(anyEvent.data);
        
                console.log("WINDOW: " + eventData);

                if(eventData && eventData.method == "payloadResolved") {

                  document.removeAllListeners("message");
                  if(typeof window.addEventListener === 'function') {
                    window.removeAllListeners("message");
                  }

                  if(eventData.reason == "SIGNED") {
                    //create own response
                    let message = {
                      signed: true,
                      payload_uuidv4: eventData.uuid
                    }
                    
                    resolve(message);

                  } else if(eventData.reason == "DECLINED") {
                    //user closed without signing
                    resolve(null)
                  }
                }
              }
            } catch(err) {
              //ignore errors
            }
          });
        }
      });
    } catch(err) {
      this.loadingData = false;
      //this.infoLabel = JSON.stringify(err);
    }
  }

  async payForToken() {

    this.loadingData = true;

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.issuerAccount,
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.issuerAccount,
          TransactionType: "Payment",
          Memos : [
                    {Memo: {MemoType: Buffer.from("Burning-Payment", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(JSON.stringify({issuer: this.issuerAccount.trim(),currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode.trim())}) , 'utf8').toString('hex').toUpperCase()}},
                    {Memo: {MemoType: Buffer.from("KYC-ACCOUNT", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.kycAccount , 'utf8').toString('hex').toUpperCase()}}
                  ]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to issue your Token from! (Issuer Account)",
          blob: {
            purpose: "Token Creation Service"
          }
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {
    
        this.paymentStarted = true;

        let txInfo = await this.xummApi.checkPayment(message.payload_uuidv4);
          //console.log('The generic dialog was closed: ' + JSON.stringify(info));

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          if(isValidXRPAddress(txInfo.account))
            this.paymentSuccessfull = true;
          else
            this.paymentSuccessfull = false;
        } else {
          this.paymentSuccessfull = false;
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async signInWithIssuerAccount() {
    this.loadingData = true;

    try {
      //setting up xumm payload and waiting for websocket
      let backendPayload:GenericBackendPostRequest = {
        options: {
            web: false,
            signinToValidate: true,
            pushDisabled: true
        },
        payload: {
            txjson: {
              Account: this.issuerAccount,         
              TransactionType: "SignIn"
            },
            custom_meta: {
              instruction: "Please sign with the issuer account!",
              blob: { source: "Issuer"}
            }
        }
      }

      try {
        let message:any = await this.waitForTransactionSigning(backendPayload);

        //this.infoLabel = "label 1 received: " + JSON.stringify(message);

        if(message && message.payload_uuidv4) {

          let checkSignin:TransactionValidation = await this.xummApi.checkSignIn(message.payload_uuidv4);
          //this.infoLabel2 = "signInToValidateTimedPayment: " + JSON.stringify(checkPayment);
          //console.log("login to validate payment: " + JSON.stringify(checkPayment));

          this.signInAccount = checkSignin.account;

          //if(checkPayment && checkPayment.success && checkPayment.testnet == this.isTestMode) {
          //  this.paymentFound = true;
          //} else if(checkPayment && checkPayment.account) {
          //  this.paymentFound = false;
          //}
        }
      } catch(err) {
        this.handleError(err);
      }

      if(this.issuerAccount && this.signInAccount && this.issuerAccount === this.signInAccount) {
        if(!this.isTestMode) {
          let kycResponse:any = await this.xummApi.getKycStatus(this.issuerAccount)

          this.infoLabel3 = JSON.stringify(kycResponse);

          this.accountHasKYC = kycResponse && kycResponse.account === this.issuerAccount && kycResponse.kycApproved;

          //save kyc account
          if(kycResponse && kycResponse.kycApproved)
            this.kycAccount = kycResponse.account
        } else {
          this.accountHasKYC = true;
          this.kycAccount = this.issuerAccount;
        }
      }
    } catch(err) {
      console.log("SOME ERROR HAPPENED. IGNORE?")
    }

    this.loadingData = false;
  }

  async loadAccountDataIssuer(xrplAccount: string) {
    try {
      this.infoLabel2 = "loading " + xrplAccount;
      if(xrplAccount && isValidXRPAddress(xrplAccount)) {
        this.loadingData = true;
        
        let account_info_request:any = {
          command: "account_info",
          account: xrplAccount,
          "strict": true,
        }

        let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("token-create", account_info_request, this.isTestMode);
        //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
        this.infoLabel = JSON.stringify(message_acc_info);
        if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
          if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
            this.issuer_account_info = message_acc_info.result.account_data;

            this.infoLabel = JSON.stringify(this.issuer_account_info);

            this.needDefaultRipple = !flagUtil.isDefaultRippleEnabled(this.issuer_account_info.Flags)
            this.blackholeDisallowXrp = flagUtil.isDisallowXRPEnabled(this.issuer_account_info.Flags);
            this.blackholeMasterDisabled = flagUtil.isMasterKeyDisabled(this.issuer_account_info.Flags)

            //if account exists, check for already issued currencies
          } else {
            this.issuer_account_info = message_acc_info;
          }
        } else {
          this.issuer_account_info = "no account";
        }

        let gateway_balances_request:any = {
          command: "gateway_balances",
          account: xrplAccount,
          strict: true,
          ledger_index: "validated"
        }

        let gateway_balances:any = await this.xrplWebSocket.getWebsocketMessage("token-create", gateway_balances_request, this.isTestMode);

        if(gateway_balances && gateway_balances.status && gateway_balances.status === 'success' && gateway_balances.type && gateway_balances.type === 'response' && gateway_balances.result && gateway_balances.result.obligations) {
          let obligations:any = gateway_balances.result.obligations;
          
          if(obligations) {
              for (var currency in obligations) {
                  if (obligations.hasOwnProperty(currency)) {
                      this.alreadyIssuedCurrencies.push(currency);
                  }
              }
          } else {
            this.alreadyIssuedCurrencies = [];
          }
        } else {                
          this.alreadyIssuedCurrencies = [];
        }

        //load balance data
        let accountLinesCommand:any = {
          command: "account_lines",
          account: xrplAccount,
          ledger_index: "validated"
        }

        let accountLines:any = await this.xrplWebSocket.getWebsocketMessage('token-create', accountLinesCommand, this.isTestMode);
        
        this.hasOutgoingTrustlines = accountLines && accountLines.result && accountLines.result.lines && accountLines.result.lines.length > 0 && accountLines.result.lines.filter(line => Number(line.limit) > 0).length > 0;
        
      } else {
        this.issuer_account_info = "no account"
        this.alreadyIssuedCurrencies = [];
      }
    } catch(err) {
      this.errorLabel = JSON.stringify(err);
    }
  }

  getAvailableBalanceIssuer(): number {
    return this.getAvailableBalance(this.issuer_account_info);
  }

  getAvailableBalanceRecipient(): number {
    return this.getAvailableBalance(this.recipient_account_info);
  }

  getAvailableBalance(accountInfo: any): number {
    if(accountInfo && accountInfo.Balance) {
      let balance:number = Number(accountInfo.Balance);
      balance = balance - this.accountReserve; //deduct acc reserve
      balance = balance - (accountInfo.OwnerCount * this.ownerReserve); //deduct owner count
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance
      else
        return 0;
      
    } else {
      return 0;
    }
  }

  isAllowedToBlackhole(): boolean {
    return this.issuer_account_info && (!this.issuer_account_info.OwnerCount || this.issuer_account_info.OwnerCount == 0);
  }

  async signInWithRecipientAccount() {
    this.loadingData = true;
    //setting up xumm payload and waiting for websocket
    let backendPayload:GenericBackendPostRequest = {
      options: {
          web: false,
          signinToValidate: true,
          pushDisabled: true
      },
      payload: {
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            instruction: "Please choose the account which should receive your token. This account is called 'Recipient account'.\n\nPlease sign the request to confirm.",
            blob: { source: "Recipient"}
          }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(backendPayload);

      if(message && message.payload_uuidv4) {

        let transactionResult = await this.xummApi.checkSignIn(message.payload_uuidv4);

        if(transactionResult && transactionResult.account && isValidXRPAddress(transactionResult.account)) {
          await this.loadAccountDataRecipient(transactionResult.account);
        }
      }      
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async loadAccountDataRecipient(xrplAccount: string) {
    this.loadingData = true;
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      this.loadingData = true;
      
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("token-create", account_info_request, this.isTestMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.recipient_account_info = message_acc_info.result.account_data;
        } else {
          this.recipient_account_info = message_acc_info;
        }
      } else {
        this.recipient_account_info = "no account";
      }
    } else {
      this.recipient_account_info = "no account"
    }
  }

  async loadTransactionsAndNext() {
    this.loadIssuerTransactions(this.issuerAccount.trim());
    this.moveNext();
  }

  async loadIssuerTransactions(issuerAccount: string) {
    try {
      this.loadingAccountTransactions = true;

      let maxLoop = 10;

      console.log("checking existing transactions")

      //load account lines
      let accountTransactions:any = {
        command: "account_tx",
        account: issuerAccount,
        limit: 1000
      }

      //console.log("starting to read account lines!")
      console.log("accountTransactions: " + JSON.stringify(accountTransactions));

      let accountTx = await this.xrplWebSocket.getWebsocketMessage('issuer-tx', accountTransactions, this.isTestMode);

      console.log("accountTx: " + JSON.stringify(accountTx));

      if(accountTx?.result?.transactions) {
        
        let transactions:any[] = accountTx?.result?.transactions;

        let marker = accountTx.result.marker;

        for(let i = 0; i < transactions.length; i++) {
          //scanning transactions for previous payments
          console.log("looping through transactions")
          try {
            let transaction = transactions[i];

            console.log("tx " + i + " : " + JSON.stringify(transaction));

            console.log("payment amount to check for: " + JSON.stringify(this.getPurchaseAmountXRP()*1000000).toString());

            if(transaction?.tx?.TransactionType === 'Payment' && transaction?.tx?.Destination === 'rrnpnAny58ak5Q6po8KQyZXnkHMAhyjhYx' && transaction?.tx?.Memos && transaction?.meta?.TransactionResult === "tesSUCCESS" && transaction?.meta?.delivered_amount === (this.getPurchaseAmountXRP()*1000000).toString()) {
              //parse memos:
              if(transaction.tx.Memos[0] && transaction.tx.Memos[0].Memo) {
                let memoType = Buffer.from(transaction.tx.Memos[0].Memo.MemoType, 'hex').toString('utf8');
                
                console.log("memoType: " + JSON.stringify(memoType));

                if(this.issuerAccount && this.currencyCode && memoType === 'Burning-Payment') {
                  let memoData = JSON.parse(Buffer.from(transaction.tx.Memos[0].Memo.MemoData, 'hex').toString('utf8'));

                  console.log("memoData: " + JSON.stringify(memoData));

                  if(memoData.issuer === this.issuerAccount.trim() && memoData.currency === normalizer.getCurrencyCodeForXRPL(this.currencyCode.trim())) {
                    this.paymentFound = true;
                    this.paymentChecked = true;
                    console.log("PAYMENT FOUND!");
                    this.loadingAccountTransactions = false;
                    return;
                  }
                }
              }
            }
          } catch(err) {
            //parse error, continue!
          }
        }

        //console.log("marker: " + marker);
        //console.log("LEDGER_INDEX : " + accountLines.result.ledger_index);


        while(marker && maxLoop > 0 && !this.paymentFound && !this.paymentChecked) {
            maxLoop--;
            //console.log("marker: " + marker);
            accountTransactions.marker = marker;
            accountTransactions.ledger_index = accountTx.result.ledger_index;

            //await this.xrplWebSocket.getWebsocketMessage("token-trasher", server_info, this.isTestMode);

            accountTx = await this.xrplWebSocket.getWebsocketMessage('issuer-tx', accountTransactions, this.isTestMode);

            marker = accountTx?.result?.marker;

            if(accountTx?.result?.transactions) {
              transactions = accountTx?.result?.transactions;

              marker = accountTx.result.marker;
      
              for(let i = 0; i < transactions.length; i++) {
                //scanning transactions for previous payments
                try {
                  let transaction = transactions[i];

                  console.log("tx " + i + " : " + JSON.stringify(transaction));

                  console.log("payment amount to check for: " + JSON.stringify(this.getPurchaseAmountXRP()*1000000).toString());

                  if(transaction?.tx?.TransactionType === 'Payment' && transaction?.tx?.Memos && transaction?.meta?.TransactionResult === "tesSUCCESS" && transaction?.meta?.delivered_amount === (this.getPurchaseAmountXRP()*1000000).toString()) {
                    //parse memos:
                    if(transaction.tx.Memos[0] && transaction.tx.Memos[0].Memo) {
                      let memoType = Buffer.from(transaction.tx.Memos[0].Memo.MemoType, 'hex').toString('utf8');
                      
                      console.log("memoType: " + JSON.stringify(memoType));

                      if(this.issuerAccount && this.currencyCode && memoType === 'Burning-Payment') {
                        let memoData = JSON.parse(Buffer.from(transaction.tx.Memos[0].Memo.MemoData, 'hex').toString('utf8'));

                        console.log("memoData: " + JSON.stringify(memoData));

                        if(memoData.issuer === this.issuerAccount.trim() && memoData.currency === normalizer.getCurrencyCodeForXRPL(this.currencyCode.trim())) {
                          this.paymentFound = true;
                          this.paymentChecked = true;
                          console.log("PAYMENT FOUND!");
                          this.loadingAccountTransactions = false;
                          return;
                        }
                      }
                    }
                  }
                } catch(err) {
                  //parse error, continue!
                }
              }
            } else {
                marker = null;
            }
        }

      }
    } catch(err) {
      console.log("ERR LOADING ACC TX")
      console.log(JSON.stringify(err));
    }

    this.paymentChecked = true;
    this.loadingAccountTransactions = false;
  }

  async sendDefaultRipple() {

    this.loadingData = true;

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.issuerAccount,
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.issuerAccount,
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DEFAULT_RIPPLE
        },
        custom_meta: {
          instruction: "- Set 'DefaultRipple' flag to the issuing account\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {

        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);
        
        if(txInfo && txInfo.success && txInfo.testnet == this.isTestMode) {
          if(this.issuerAccount == txInfo.account)
            await this.loadAccountDataIssuer(this.issuerAccount);
          else { //signed with wrong account
            this.snackBar.open("You signed with the wrong account. Please sign with Issuer Account!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          }
        } else {
          //tx not successful
          this.snackBar.open("Transaction not successful!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && /^[a-zA-Z\d?!@#$%^&*<>(){}[\]|]{3,20}$/.test(this.currencyCode) && this.currencyCode.toUpperCase() != "XRP";
    this.currencyAlreadyIssued = this.validCurrencyCode && this.alreadyIssuedCurrencies.includes(this.currencyCode.trim());
    this.paymentStarted = false;
    this.paymentSuccessfull = false;
    this.paymentFound = false;
    this.paymentChecked = false;
  }

  getCurrencyCodeForXRPL(): string {
    return normalizer.getCurrencyCodeForXRPL(this.currencyCode);
  }

  checkChangesLimit() {
    if(this.limit) {

      if(!this.limit.includes("e")) {
        this.validLimit = /^[1-9]\d*(\.\d{1,15})?$/.test(this.limit);
      } else {
        //console.log("checking scientific notation");
        try {
          let first:number = Number(this.limit.substring(0, this.limit.indexOf('e')));
          let second:number = Number(this.limit.substring(this.limit.indexOf('e')+1));

          //console.log("first: " + first);
          //console.log("second: " + second);

          if(Number.isInteger(first) && Number.isInteger(second)) {
            this.validLimit = first > 0 && first <= 9999999999999999 && second >= -96 && second <= 80
          } else {
            this.validLimit = false;
          }
        } catch(err) {
          this.validLimit = false;
        }
      }
    }

    if(this.validLimit)
      this.validLimit = this.limit && parseFloat(this.limit) >= 0;
  }

  async setTrustline() {

    this.loadingData = true;

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.recipient_account_info.Account,
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.recipient_account_info.Account,
          TransactionType: "TrustSet",
          Flags: 131072, //no ripple
          LimitAmount: {
            currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode),
            issuer: this.issuerAccount.trim(),
            value: normalizer.tokenNormalizer(this.limit.toString())
          }
        },
        custom_meta: {
          instruction: "- Set TrustLine between Token recipient and issuer\n\n- Please sign with the RECIPIENT account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      //this.infoLabel = "setTrustline " + JSON.stringify(this.recipient_account_info);

      if(message && message.payload_uuidv4) {

        let info = await this.xummApi.validateTransaction(message.payload_uuidv4)

        if(info && info.success && info.account && info.testnet == this.isTestMode) {
          if(this.recipient_account_info.Account == info.account) {
            this.recipientTrustlineSet = true;
          } else {
            this.recipientTrustlineSet = false;
            this.snackBar.open("You signed with the wrong account. Please sign with Recipient Account!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          }
        } else {
          this.recipientTrustlineSet = false;
          this.snackBar.open("Transaction not successful!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async issueToken() {

    this.loadingData = true;
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer(),
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "Payment",
          Destination: this.recipient_account_info.Account,
          Amount: {
            currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode),
            issuer: this.issuerAccount.trim(),
            value: normalizer.tokenNormalizer(this.limit.toString())
          },
          Flags: 131072
        },
        custom_meta: {
          instruction: "- Issuing " + this.limit + " " + this.currencyCode + " to: " + this.recipient_account_info.Account + "\n\n- Please sign with the ISSUER account!",
          blob: {
            issueToken: true
          }
        }
      }
    }

    let memos:any[] = [{Memo: {MemoType: Buffer.from("KYC-ACCOUNT", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.kycAccount , 'utf8').toString('hex').toUpperCase()}}];


    if(this.memoInput && this.memoInput.trim().length > 0 && !genericBackendRequest.payload.txjson.Memos) {
      memos.push({Memo: {MemoType: Buffer.from("Token-Creation", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.memoInput.trim(), 'utf8').toString('hex').toUpperCase()}})
    }

    genericBackendRequest.payload.txjson.Memos = memos;

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {

        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        this.infoLabel = JSON.stringify(txInfo);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          if(this.issuerAccount === txInfo.account) {
            this.weHaveIssued = true;
          } else {
            this.weHaveIssued = false;
            this.snackBar.open("You signed with the wrong account. Please sign with Issuer Account!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          }
        } else {
          this.weHaveIssued = false;
          this.snackBar.open("Transaction not successful!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async sendRemainingXRP() {
    this.loadingData = true;
    //reload issuer balance
    await this.loadAccountDataIssuer(this.issuerAccount)

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer(),
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "Payment",
          Destination: this.recipient_account_info.Account,
          Amount: this.getAvailableBalanceIssuer()*1000000+""
        },
        custom_meta: {
          instruction: "- Sending " + this.getAvailableBalanceIssuer() + " XRP to: " + this.recipient_account_info.Account + " to empty issuer account\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {

        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          if(this.issuerAccount == txInfo.account) {
            await this.loadAccountDataIssuer(this.issuerAccount);
          } else {
            await this.loadAccountDataIssuer(this.issuerAccount);
            this.snackBar.open("You signed with the wrong account. Please sign with Issuer Account!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          }
        } else {
          await this.loadAccountDataIssuer(this.issuerAccount);
          this.snackBar.open("Transaction not successful!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async disallowIncomingXrp() {
    this.loadingData = true;
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer(),
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_INCOMING_XRP
        },
        custom_meta: {
          instruction: "- Disallow incoming XRP\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {

        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          this.blackholeDisallowXrp = true;
        } else {
          this.blackholeDisallowXrp = false;
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async setBlackholeAddress() {
    this.loadingData = true;
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer(),
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "SetRegularKey",
          RegularKey: "rrrrrrrrrrrrrrrrrrrrBZbvji"
        },
        custom_meta: {
          instruction: "Set RegularKey to: rrrrrrrrrrrrrrrrrrrrBZbvji\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {
        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          this.blackholeRegularKeySet = true;
        } else {
          this.blackholeRegularKeySet = false;
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async disableMasterKeyForIssuer() {
    this.loadingData = true;

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer(),
        pushDisabled: true
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_MASTER_KEY
        },
        custom_meta: {
          instruction: "- Disable Master Key\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {
        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          this.blackholeMasterDisabled = true;
        } else {
          this.blackholeMasterDisabled = false;
        }
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  openTestnetInBrowser() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xrpl.services/tools"
      }));
    }
  }

  openBlackholeLink() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xrpl.services/tokens"
      }));
    }
  }

  getTrustlineLink(): string {
    let link = "";
    if(this.getIssuer() && this.currencyCode && this.limit && this.weHaveIssued) {
      let testnetString:string = this.isTestMode ? "&testnet=true" : null;
      link = "https://xrpl.services?issuer="+this.getIssuer()+"&currency="+this.currencyCode+"&limit="+this.limit;
      if(testnetString) {
        link += testnetString
      }
    }

    return link;
  }

  getPurchaseAmountXRP(): number {
    if(this.fixAmounts && this.fixAmounts["*"])
      return parseInt(this.fixAmounts["*"]) / 1000000;
    else
      return 75;
  }

  copyLink() {
    if(this.getIssuer() && this.currencyCode && this.limit) {
      clipboard(this.getTrustlineLink());
      this.snackBar.dismiss();
      this.snackBar.open("TrustLine link copied to clipboard!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom'});
    }
  }

  openTermsAndConditions() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xrpl.services/terms"
      }));
    }
  }

  openPrivacyPolicy() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xrpl.services/privacy"
      }));
    }
  }

  openVanityApp() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xumm.app/detect/xapp:xumm.vanity"
      }));
    }
  }

  openBlackholeAccount() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xrpscan.com/account/rrnpnAny58ak5Q6po8KQyZXnkHMAhyjhYx"
      }));
    }
  }

  openXummDocs() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://xumm.readme.io/docs"
      }));
    }
  }

  openXummExample() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      //this.infoLabel = "opening sign request";
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: "openBrowser",
        url: "https://oauth2-pkce-demo.xumm.dev/"
      }));
    }
  }

  close() {
    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'close'
      }));
    }
  }

  moveNext() {
    // complete the current step
    this.stepper.selected.completed = true;
    this.stepper.selected.editable = false;
    // move to next step
    this.stepper.next();
    this.stepper.selected.editable = true;

    if(this.stepper.selectedIndex == 1) {
      this.scrollToTop();
    }
  }

  moveBack() {
    //console.log("steps: " + this.stepper.steps.length);
    // move to previous step
    this.stepper.selected.completed = false;
    this.stepper.selected.editable = false;

    this.stepper.steps.forEach((item, index) => {
      if(index == this.stepper.selectedIndex-1 && this.stepper.selectedIndex-1 >= 0) {
        item.editable = true;
        item.completed = false;
      }
    })

    this.stepper.previous();
  }

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingData = false;
    this.paymentFound = false;
    this.paymentSuccessfull = false;
    this.validIssuer = false;
    this.issuer_account_info = null;
    this.needDefaultRipple = true;
    this.hasOutgoingTrustlines = false;
    this.alreadyIssuedCurrencies = null;
  }

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxDisclaimer = this.checkBoxDisclaimer2 = this.checkBoxIssuingText = this.checkBoxIssuerInfo = false;
    this.currencyCode = this.limit = null;
    this.validCurrencyCode = this.validLimit = false;
    this.issuerAccount = this.issuer_account_info = null;
    this.validIssuer = this.paymentFound = this.paymentSuccessfull = false;
    this.needDefaultRipple = true;
    this.recipientTrustlineSet = false;
    this.recipient_account_info = null;
    this.weHaveIssued = false;
    this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 =this.checkBoxBlackhole5 = false;
    this.blackholeMasterDisabled = this.blackholeRegularKeySet = this.blackholeDisallowXrp =  false;
    this.hasOutgoingTrustlines = false;
    this.alreadyIssuedCurrencies = null;
    this.stepper.reset();
  }

  scrollToTop() {
    window.scrollTo(0, 0);
  }

  handleError(err) {
    if(err && JSON.stringify(err).length > 2) {
      this.errorLabel = JSON.stringify(err);
      this.scrollToTop();
    }
    this.snackBar.open("Error occured. Please try again!", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
  }

  copyError() {
    if(this.errorLabel) {
      clipboard(this.errorLabel);
      this.snackBar.dismiss();
      this.snackBar.open("Error text copied to clipboard!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
    }
  }
}
