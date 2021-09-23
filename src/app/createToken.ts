import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { XummService } from './services/xumm.service'
import { XRPLWebsocket } from './services/xrplWebSocket';
import { Observable, Subject, Subscription } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from './utils/types';
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

  issuer_account_info:any;
  recipient_account_info:any;
  isTestMode:boolean = false;

  private issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;

  currencyCode:string;
  limit:string;
  validCurrencyCode:boolean = false;
  currencyAlreadyIssued:boolean = false;
  validLimit:boolean = false;
  isNft:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentSuccessfull:boolean = false;
  paymentFound: boolean = false;
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

  websocket: WebSocketSubject<any>;

  infoLabel:string = null;
  infoLabel2:string = null;

  errorLabel:string = null;

  memoInput: string;
  alreadyIssuedCurrencies:string[] = [];

  title: string = "Xumm Community xApp";
  tw: TypeWriter

  @ViewChild('stepper') stepper: MatStepper;

  async ngOnInit(): Promise<void> {

    this.loadFeeReserves();

    this.ottReceived = this.ottChanged.subscribe(async ottData => {
      //this.infoLabel = "ott received: " + JSON.stringify(ottData);
      //console.log("ottReceived: " + JSON.stringify(ottData));

      if(ottData) {

        //this.infoLabel = JSON.stringify(ottData);
        
        this.isTestMode = ottData.nodetype == 'TESTNET';

        //this.infoLabel = "changed mode to testnet: " + this.testMode;

        if(ottData && ottData.account && ottData.accountaccess == 'FULL') {

          this.issuer_account_info = "no account";
          //await this.loadAccountDataIssuer(ottData.account);
          //this.loadingData = false;

          //await this.loadAccountData(ottData.account); //false = ottResponse.node == 'TESTNET' 
        } else {
          this.issuer_account_info = "no account";
        }
      }

      //this.testMode = true;
      //await this.loadAccountData("rELeasERs3m4inA1UinRLTpXemqyStqzwh");
      //await this.loadAccountData("r9N4v3cWxfh4x6yUNjxNy3DbWUgbzMBLdk");
      //this.loadingData = false;
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

    //add event listeners
    if (typeof window.addEventListener === 'function') {
      window.addEventListener("message", event => this.handleOverlayEvent(event));
    }
    
    if (typeof document.addEventListener === 'function') {
      document.addEventListener("message", event => this.handleOverlayEvent(event));
    }

    this.tw = new TypeWriter(["Xumm Community xApp", "created by nixerFFM", "Xumm Community xApp"], t => {
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

    console.log("resolved accountReserve: " + this.accountReserve);
    console.log("resolved ownerReserve: " + this.ownerReserve);
  }

  async handleOverlayEvent(event:any) {
    try {
      if(event && event.data) {
        let eventData = JSON.parse(event.data);

        if(eventData && eventData.method == "payloadResolved" && eventData.reason == "DECLINED") {
            //user closed without signing
            this.loadingData = false;
        }
      }
    } catch(err) {
      //ignore errors
    }
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
          expire: 2,
          forceAccount: isValidXRPAddress(payloadRequest.payload.txjson.Account+"")
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

    //remove old websocket
    try {
      if(this.websocket && !this.websocket.closed) {
        this.websocket.unsubscribe();
        this.websocket.complete();
      }

      return new Promise( (resolve, reject) => {

        this.websocket = webSocket(xummResponse.refs.websocket_status);
        this.websocket.asObservable().subscribe(async message => {
            //console.log("message received: " + JSON.stringify(message));
            //this.infoLabel = "message received: " + JSON.stringify(message);

            if((message.payload_uuidv4 && message.payload_uuidv4 === xummResponse.uuid) || message.expired || message.expires_in_seconds <= 0) {

              if(this.websocket) {
                this.websocket.unsubscribe();
                this.websocket.complete();
              }
              
              return resolve(message);
            }
        });
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
          Memos : [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for creating Token via xApp: '"+this.currencyCode.trim()+"'", 'utf8').toString('hex').toUpperCase()}}]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to issue your Token from! (Issuer Account)",
        }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {
    
        this.paymentStarted = true;

        let txInfo = await this.xummApi.checkTimedPayment(message.payload_uuidv4);
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
            instruction: "Please choose the account which should create the token. This account is called 'Issuer account'.\n\nPlease sign the request to confirm.",
            blob: { source: "Issuer"}
          }
      }
    }

    try {
      let message:any = await this.waitForTransactionSigning(backendPayload);

      //this.infoLabel = "label 1 received: " + JSON.stringify(message);

      if(message && message.payload_uuidv4) {

        let checkPayment:TransactionValidation = await this.xummApi.signInToValidateTimedPayment(message.payload_uuidv4);
        //this.infoLabel2 = "signInToValidateTimedPayment: " + JSON.stringify(checkPayment);
        //console.log("login to validate payment: " + JSON.stringify(checkPayment));
        if(checkPayment && checkPayment.success && checkPayment.testnet == this.isTestMode) {
          this.issuerAccount = checkPayment.account;
          this.validIssuer = true;
          this.paymentFound = true;
        } else if(checkPayment && checkPayment.account) {
          this.issuerAccount = checkPayment.account;
          this.validIssuer = true;
          this.paymentFound = false;
        }


        await this.loadAccountDataIssuer(this.issuerAccount);
      }
    } catch(err) {
      this.handleError(err);
    }

    this.loadingData = false;
  }

  async loadAccountDataIssuer(xrplAccount: string) {
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
          this.issuer_account_info = message_acc_info.result.account_data;

          //this.infoLabel = JSON.stringify(this.issuer_account_info);

          this.needDefaultRipple = !flagUtil.isDefaultRippleEnabled(this.issuer_account_info.Flags)
          this.blackholeDisallowXrp = flagUtil.isDisallowXRPEnabled(this.issuer_account_info.Flags);
          this.blackholeMasterDisabled = flagUtil.isMasterKeyDisabled(this.issuer_account_info.Flags)

          //if account exists, check for already issued currencies
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

        } else {
          this.issuer_account_info = message_acc_info;
          this.alreadyIssuedCurrencies = [];
        }
      } else {
        this.issuer_account_info = "no account";
        this.alreadyIssuedCurrencies = [];
      }
    } else {
      this.issuer_account_info = "no account"
      this.alreadyIssuedCurrencies = [];
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
          //tx not successfull
          this.snackBar.open("Transaction not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
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
  }

  getCurrencyCodeForXRPL(): string {
    return normalizer.getCurrencyCodeForXRPL(this.currencyCode);
  }

  checkChangesLimit() {
    if(this.limit) {

      if(!this.limit.includes("e")) {
        this.validLimit = !(/[^.0-9]|\d*\.\d{16,}/.test(this.limit));
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
          this.snackBar.open("Transaction not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
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
          instruction: "- Issuing " + this.limit + " " + this.currencyCode + " to: " + this.recipient_account_info.Account + "\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    if(this.memoInput && this.memoInput.trim().length > 0 && !genericBackendRequest.payload.txjson.Memos) {
      genericBackendRequest.payload.txjson.Memos = [{Memo: {MemoType: Buffer.from("Token-Creation", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.memoInput.trim(), 'utf8').toString('hex').toUpperCase()}}];
    }

    try {
      let message:any = await this.waitForTransactionSigning(genericBackendRequest);

      if(message && message.payload_uuidv4) {

        let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

        if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
          if(this.issuerAccount == txInfo.account) {
            this.weHaveIssued = true;
          } else {
            this.weHaveIssued = false;
            this.snackBar.open("You signed with the wrong account. Please sign with Issuer Account!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          }
        } else {
          this.weHaveIssued = false;
          this.snackBar.open("Transaction not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
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
          this.snackBar.open("Transaction not successfull!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
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

  copyLink() {
    if(this.getIssuer() && this.currencyCode && this.limit) {
      clipboard("https://xumm.community?issuer="+this.getIssuer()+"&currency="+this.currencyCode+"&limit="+this.limit);
      this.snackBar.dismiss();
      this.snackBar.open("TrustLine link copied to clipboard!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom'});
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
  }

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxDisclaimer = this.checkBoxIssuingText = this.checkBoxIssuerInfo = false;
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
