import React from "react";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-links">
          <a href="#privacy" className="footer-link">Privacy Policy</a>
          <span className="footer-separator">•</span>
          <a href="#terms" className="footer-link">Terms of Service</a>
          <span className="footer-separator">•</span>
          <a href="#security" className="footer-link">Security Policy</a>
          <span className="footer-separator">•</span>
          <a href="#support" className="footer-link">Support Desk</a>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} MedRemind. Built to provide professional healthcare assistance and wellness tracking.
        </div>
      </div>
    </footer>
  );
}

export default Footer;
