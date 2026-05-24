import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-container">
      <h1>FP — Macro Trend Analyzer</h1>
      <p>Sign in to continue</p>
      <div #googleBtn class="google-btn"></div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 85vh;
      gap: 16px;
    }
    h1 { margin: 0; }
    p { color: #666; margin: 0 0 24px; }
  `],
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleBtn') googleBtn!: ElementRef;

  constructor(private auth: AuthService) {}

  ngAfterViewInit(): void {
    this.auth.initGoogleSignIn(this.googleBtn.nativeElement);
  }
}
