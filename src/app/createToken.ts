import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { XummService } from './services/xumm.service'
import { XRPLWebsocket } from './services/xrplWebSocket';
import { Observable, Subject, Subscription } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from './utils/types';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import * as flagUtil from './utils/flagutils';
import { MatStepper } from '@angular/material/stepper';
import * as normalizer from './utils/normalizers';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { XummTypes } from 'xumm-sdk';
import { TypeWriter } from './utils/TypeWriter';

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
    private xrplWebSocket: XRPLWebsocket,
    private googleAnalytics: GoogleAnalyticsService) { }

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

  issuer_account_info:any;
  isTestMode:boolean = false;

  private issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;

  currencyCode:string;
  limit:number;
  validCurrencyCode:boolean = false;
  validLimit:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentNotSuccessfull:boolean = false;
  paymentNotFound: boolean = false;
  loadingIssuerAccount:boolean = false;

  needDefaultRipple:boolean = true;
  recipientAddress:string;
  recipientTrustlineSet:boolean = false;
  weHaveIssued:boolean = false;

  @Input()
  ottChanged: Observable<any>;

  @Input()
  themeChanged: Observable<any>;

  private ottReceived: Subscription;
  private themeReceived: Subscription;

  themeClass = 'dark-theme';
  backgroundColor = '#000000';

  testMode:boolean = false;
  loadingData:boolean = false;

  websocket: WebSocketSubject<any>;

  recipientAccount:string = null;

  title: string = "Xumm Community xApp";
  tw: TypeWriter

  @ViewChild('stepper') stepper: MatStepper;

  async ngOnInit(): Promise<void> {
    this.ottReceived = this.ottChanged.subscribe(async ottData => {
      //console.log("ottReceived: " + JSON.stringify(ottData));

      if(ottData) {

        //this.infoLabel = JSON.stringify(ottData);
        
        this.testMode = ottData.nodetype == 'TESTNET';

        //this.infoLabel = "changed mode to testnet: " + this.testMode;

        if(ottData && ottData.account && ottData.accountaccess == 'FULL') {

          await this.loadAccountDataIssuer(ottData.account);
          this.loadingData = false;

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

  getIssuer(): string {
    return this.issuerAccount;
  }

  async waitForTransactionSigning(payloadRequest: GenericBackendPostRequest): Promise<any> {
    this.loadingData = true;
    //this.infoLabel = "Opening sign request";
    let xummResponse:XummTypes.XummPostPayloadResponse;
    try {
        //console.log("sending xumm payload: " + JSON.stringify(xummPayload));
        xummResponse = await this.xummApi.submitPayload(payloadRequest);
        //this.infoLabel = "Called xumm successfully"
        console.log(JSON.stringify(xummResponse));
        if(!xummResponse || !xummResponse.uuid) {
          this.snackBar.open("Error contacting XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
          return;
        }        
    } catch (err) {
        //console.log(JSON.stringify(err));
        this.snackBar.open("Could not contact XUMM backend", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
        return;
    }

    if (typeof window.ReactNativeWebView !== 'undefined') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        command: 'openSignRequest',
        uuid: xummResponse.uuid
      }));
    }

    //this.infoLabel = "Showed sign request to user";

    //remove old websocket
    if(this.websocket && !this.websocket.closed) {
      this.websocket.unsubscribe();
      this.websocket.complete();
  }

    this.websocket = webSocket(xummResponse.refs.websocket_status);
    this.websocket.asObservable().subscribe(async message => {
        //console.log("message received: " + JSON.stringify(message));
        //this.infoLabel = "message received: " + JSON.stringify(message);

        if(message.payload_uuidv4 && message.payload_uuidv4 === xummResponse.uuid) {
            
          if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
          }

          if(message.signed) {
              return Promise.resolve(message);
          } else {
            return Promise.reject(message);
          }
        } else if(message.expired || message.expires_in_seconds <= 0) {
          
          if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
          }

          return Promise.reject(message);
        }
    });
  }

  async payForToken() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "Payment",
          Memos : [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for creating Token: '"+this.currencyCode.trim()+"'", 'utf8').toString('hex').toUpperCase()}}]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to issue your Token from!",
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.checkTimedPayment(message.payload_uuidv4);
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

    if(txInfo && txInfo.success && txInfo.account && (!txInfo.testnet || this.isTestMode)) {
      if(isValidXRPAddress(txInfo.account))
        this.issuerAccount = txInfo.account;
        this.validIssuer = true;
        this.paymentNotSuccessfull = false;
        this.paymentNotFound = false;
        await this.loadAccountDataIssuer(this.issuerAccount);
    } else {
      this.paymentNotSuccessfull = true;
      this.paymentNotFound = false;
    }
  }

  async signInWithIssuerAccount() {
    this.loadingData = true;
    //setting up xumm payload and waiting for websocket
    let backendPayload:GenericBackendPostRequest = {
      options: {
          web: false,
          signinToValidate: true
      },
      payload: {
          options: {
              expire: 5
          },
          txjson: {
              TransactionType: "SignIn"
          },
          custom_meta: {
            instruction: "Please choose the account which should create the token. This account is called 'Issuer account'.\n\nPlease sign the request to confirm.",
            blob: { source: "Issuer"}
          }
      }
    }

    let message:any = await this.waitForTransactionSigning(backendPayload);

    let transactionResult = await this.xummApi.checkSignIn(message.payload_uuidv4);

    if(transactionResult && transactionResult.success && transactionResult.account && isValidXRPAddress(transactionResult.account)) {
      let refererURL:string;
      if(document.URL.includes('?')) {
          refererURL = document.URL.substring(0, document.URL.indexOf('?'));
      } else {
          refererURL = document.URL;
      }
      let checkPayment:TransactionValidation = await this.xummApi.signInToValidateTimedPayment(transactionResult.payloadId, refererURL);
      //console.log("login to validate payment: " + JSON.stringify(checkPayment));
      if(checkPayment && checkPayment.success && (!checkPayment.testnet || this.isTestMode)) {
        this.issuerAccount = transactionResult.account;
        this.validIssuer = true;
        this.paymentNotSuccessfull = false;
        this.paymentNotFound = false;
        await this.loadAccountDataIssuer(this.issuerAccount);
        this.googleAnalytics.analyticsEventEmitter('login_for_token', 'easy_token', 'easy_token_component');
      } else {
        this.issuerAccount = transactionResult.account;
        this.validIssuer = true;
        this.paymentNotFound = true;
        this.paymentNotSuccessfull = false;
        this.loadingIssuerAccount = false;
      }
    } else if(transactionResult && transactionResult.account) {
      this.issuerAccount = transactionResult.account;
      this.validIssuer = true;
      this.paymentNotFound = true;
      this.paymentNotSuccessfull = false;
      this.loadingIssuerAccount = false;
    } else {
      this.issuerAccount = null;
      this.validIssuer = false;
      this.loadingIssuerAccount = false;
    }
  }

  async loadAccountDataIssuer(xrplAccount: string) {
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      //this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'xrpl_transactions_component');
      this.loadingData = true;
      
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("token-create", account_info_request, this.testMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.issuer_account_info = message_acc_info.result.account_data;

          this.needDefaultRipple = !flagUtil.isDefaultRippleEnabled(this.issuer_account_info.Flags)
          this.blackholeDisallowXrp = flagUtil.isDisallowXRPEnabled(this.issuer_account_info);
          this.blackholeMasterDisabled = flagUtil.isMasterKeyDisabled(this.issuer_account_info.Flags)
        } else {
          this.issuer_account_info = message_acc_info;
        }
      } else {
        this.issuer_account_info = "no account";
      }
    } else {
      this.issuer_account_info = "no account"
    }
  }

  async sendDefaultRipple() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.issuerAccount
      },
      payload: {
        txjson: {
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DEFAULT_RIPPLE
        },
        custom_meta: {
          instruction: "- Set 'DefaultRipple' flag to the issuing account\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);
    
    if(txInfo && txInfo.success && txInfo.testnet == this.isTestMode) {
      if(this.issuerAccount === txInfo.account)
        await this.loadAccountDataIssuer(this.issuerAccount);
      else { //signed with wrong account

      }
    } else {

    }
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && /^[a-zA-Z\d?!@#$%^&*<>(){}[\]|]{3,20}$/.test(this.currencyCode) && this.currencyCode.toUpperCase() != "XRP";
  }

  getCurrencyCodeForXRPL(): string {
    return normalizer.getCurrencyCodeForXRPL(this.currencyCode);
  }

  checkChangesLimit() {
    this.validLimit = this.limit && this.limit > 0 && !(/[^.0-9]|\d*\.\d{16,}/.test(this.limit.toString()));

    if(this.validLimit && this.limit.toString().includes('.') && this.limit.toString().substring(0,this.limit.toString().indexOf('.')).length > 40)
      this.validLimit = false;
  }

  async setTrustline() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.recipientAccount
      },
      payload: {
        txjson: {
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

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let info = await this.xummApi.validateTransaction(message.payload_uuidv4)

    if(info && info.success && info.account && info.testnet == this.isTestMode) {
      this.recipientTrustlineSet = true;
      this.recipientAddress = info.account;
    } else {
      this.recipientTrustlineSet = false;
    }
  }

  async issueToken() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.issuerAccount
      },
      payload: {
        txjson: {
          TransactionType: "Payment",
          Destination: this.recipientAddress,
          Amount: {
            currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode),
            issuer: this.issuerAccount.trim(),
            value: normalizer.tokenNormalizer(this.limit.toString())
          }
        },
        custom_meta: {
          instruction: "- Issuing " + this.limit + " " + this.currencyCode + " to: " + this.recipientAddress + "\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

    if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
      this.weHaveIssued = true;
      this.googleAnalytics.analyticsEventEmitter('token_created', 'easy_token', 'easy_token_component');
    } else {
      this.weHaveIssued = false;
    }
  }

  async disallowIncomingXrp() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_INCOMING_XRP
        },
        custom_meta: {
          instruction: "- Disallow incoming XRP\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

    if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
      this.blackholeDisallowXrp = true;
    } else {
      this.blackholeDisallowXrp = false;
    }
  }

  async setBlackholeAddress() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          TransactionType: "SetRegularKey",
          RegularKey: "rrrrrrrrrrrrrrrrrrrrBZbvji"
        },
        custom_meta: {
          instruction: "Set RegularKey to: rrrrrrrrrrrrrrrrrrrrBZbvji\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

    if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
      this.blackholeRegularKeySet = true;
    } else {
      this.blackholeRegularKeySet = false;
    }
  }

  async disableMasterKeyForIssuer() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_MASTER_KEY
        },
        custom_meta: {
          instruction: "- Disable Master Key\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    let message:any = await this.waitForTransactionSigning(genericBackendRequest);

    let txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);

    if(txInfo && txInfo.success && txInfo.account && txInfo.testnet == this.isTestMode) {
      this.blackholeMasterDisabled = true;
      this.googleAnalytics.analyticsEventEmitter('account_black_hole_succeed', 'easy_token', 'easy_token_component');
    } else {
      this.blackholeMasterDisabled = false;
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

    switch(this.stepper.selectedIndex) {
      case 0: break;
      case 1: {
        this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxIssuerInfo = false;
        break;
      }
      case 2: {
        this.isTestMode = false;
        break;
      }
      case 3: {
        this.currencyCode = null;
        this.limit = null;
        this.validCurrencyCode = false;
        this.validLimit = false;
        break;
      }
      case 4: {
        this.issuerAccount = this.issuer_account_info = null;
        this.validIssuer = false;
        this.paymentNotFound = this.paymentNotSuccessfull = false;
        this.needDefaultRipple = true;
        break;
      }
      case 5: {
        break;
      }
      case 6: {
        this.recipientTrustlineSet = false;
        this.recipientAddress = null;
        break;
      }
      case 7: {
        this.weHaveIssued = false;
        break;
      }
      case 8: {
        this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 = this.checkBoxBlackhole5 = false;
        this.blackholeRegularKeySet = this.blackholeMasterDisabled = this.blackholeDisallowXrp = false;
        break;
      }
      case 9: break;
    }

    this.stepper.previous();
  }

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.paymentNotFound = false;
    this.paymentNotSuccessfull = false;
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
    this.validIssuer = this.paymentNotFound = this.paymentNotSuccessfull = false;
    this.needDefaultRipple = true;
    this.recipientTrustlineSet = false;
    this.recipientAddress = null;
    this.weHaveIssued = false;
    this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 =this.checkBoxBlackhole5 = false;
    this.blackholeMasterDisabled = this.blackholeRegularKeySet = this.blackholeDisallowXrp =  false;
    this.stepper.reset();
  }
}
