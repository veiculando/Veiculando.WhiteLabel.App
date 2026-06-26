import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SecureStorage } from '../core/auth/secure-storage';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Veiculando.WhiteLabel.App';

  testToken() {
    console.log('Testing Secure Storage...');
    SecureStorage.setToken(environment.tokenKey, 'fake-jwt-token-123');
    const retrieved = SecureStorage.getToken(environment.tokenKey);
    console.log('Retrieved Token:', retrieved);
  }
}
