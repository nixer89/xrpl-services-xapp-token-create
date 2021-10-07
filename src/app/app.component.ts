import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { XummService } from './services/xumm.service';
import { OverlayContainer } from '@angular/cdk/overlay';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'xumm-xapp-token-create';
  themeClass:string = "dark-theme";
  backgroundColor: string = "#000000";
  
  receivedParams = false;
  alreadySent = false;

  infoLabel:string = null;

  ottReceived: Subject<any> = new Subject<any>();
  appStyleChanged: Subject<any> = new Subject<any>();

  timeout1: any;
  timeout2: any;

  constructor(private route: ActivatedRoute, private xummService: XummService, private overlayContainer: OverlayContainer) { }

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      this.infoLabel = JSON.stringify(params);
      if(this.timeout1) {
        //console.log("clearing timeout1");
        clearTimeout(this.timeout1)
      }
  
      if(this.timeout2) {
        //console.log("clearing timeout2");
        clearTimeout(this.timeout2)
      }

      let xAppToken = params.xAppToken;
      let xAppStyle = params.xAppStyle;

      this.receivedParams = xAppToken != null || xAppStyle != null;
      //console.log("has params received: " + this.receivedParams)

      //console.log("received pararms: " + JSON.stringify(params));
      this.infoLabel = "params: " + JSON.stringify(params);

      if(xAppStyle) {
        switch(xAppStyle) {
          case 'LIGHT':
            this.themeClass = 'light-theme';
            this.backgroundColor = '#FFFFFF';
            break;
          case 'DARK':
            this.themeClass = 'dark-theme';
            this.backgroundColor = '#000000';
            break;
          case 'MOONLIGHT':
            this.themeClass = 'moonlight-theme';
            this.backgroundColor = '#181A21';
            break;
          case 'ROYAL':
            this.themeClass = 'royal-theme';
            this.backgroundColor = '#030B36';
            break;
          default:
            this.themeClass = 'dark-theme';
            this.backgroundColor = '#000000';
            break;
        }
      }

      var bodyStyles = document.body.style;
      console.log("setting style :" + this.themeClass);
      bodyStyles.setProperty('--background-color', this.backgroundColor);
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.remove('light-theme');
      this.overlayContainer.getContainerElement().classList.remove('moonlight-theme');
      this.overlayContainer.getContainerElement().classList.remove('royal-theme');
      this.overlayContainer.getContainerElement().classList.add(this.themeClass);

      this.appStyleChanged.next({theme: this.themeClass, color: this.backgroundColor});

      if(xAppToken) {
        try {
          this.infoLabel = "calling backend";
          let ottResponse:any = await this.xummService.getxAppOTTData(xAppToken);
          //console.log("ottResponse: " + JSON.stringify(ottResponse));
          this.infoLabel = "ott from backend: " + JSON.stringify(ottResponse);
  
          this.alreadySent = true;
  
          if(ottResponse && ottResponse.error) {
            //console.log("error OTT, only sending app style");
            this.ottReceived.next({style: xAppStyle});
          } else {
            this.ottReceived.next(ottResponse);
            this.alreadySent = true;
          }      
        } catch(err) {
          this.infoLabel = "error: " + JSON.stringify(err);
        }
        
      } else {
        //didn't got an ott. Just send over the app style (even if not available)
        this.timeout1 = setTimeout(() => {
          //console.log("checking with: " + this.receivedParams);
          if(this.receivedParams && !this.alreadySent) {
            //console.log("only received appstyle")
            this.ottReceived.next({style: xAppStyle});
            this.alreadySent = true;
          }
        }, 1000);
      }
    });

    this.timeout2 = setTimeout(() => {
      //console.log("checking with2: " + this.receivedParams);
      if(!this.receivedParams && !this.alreadySent) {
        //console.log("didnt received any params")
        this.ottReceived.next({style: null});
        this.alreadySent = true;
      }
    }, 3000);
  }
}
