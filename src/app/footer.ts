import { Component, OnInit } from '@angular/core';
import packageInfo from '../../package.json';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html'
})
export class FooterComponent implements OnInit {

  public appVersion:string = packageInfo.version;

  constructor() { }

  ngOnInit() {
  }

}
