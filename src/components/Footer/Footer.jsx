import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './Footer.css';

const Footer = () => {
  const [isCopied, setIsCopied] = useState(false);

  const handleEmailCopy = () => {
    navigator.clipboard.writeText('leechengzhan7@gmail.com');
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  const handleSgNumberCopy = () => {
    navigator.clipboard.writeText('+65 81273530');
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  const handleMyNumberCopy = () => {
    navigator.clipboard.writeText('+60 183221917');
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  const footerAnimate = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8 }
  };

  return (
    <footer className="footer" id="contact">

      {/* Static Contact Info */}
      <motion.div className="footer-contact-text" {...footerAnimate}>
        <div className="email-container mb-4">
          <p>leechengzhan7@gmail.com</p>
          <img src={process.env.PUBLIC_URL + '/assets/icon/copy.png'} alt="Copy" className="copy-icon" onClick={handleEmailCopy} />
          {isCopied && <span className="copied-message">Copied!</span>}
        </div>
        <div>
          <span className="footer-contact-number">SG: +65 81273530</span> |  <span>MY: +60 183221917</span>
        </div>
      </motion.div>

      {/* Clickable Icons */}
      <motion.div className="footer-clickable-icons" {...footerAnimate} transition={{...footerAnimate.transition, delay: 0.2}}>
        <a href="mailto:leechengzhan7@gmail.com" target="_blank" rel="noopener noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/gmail_colourful.png'} alt="Email" className="icon" />
        </a>
        <a href="https://www.linkedin.com/in/leechengzhan/" target="_blank" rel="noopener noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/phone_blue.png'} alt="Phone" className="icon" />
        </a>
        <a href="https://wa.me/6581273530" target="_blank" rel="noopener noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/whatsapp_circle_black.png'} alt="WhatsApp" className="icon" />
        </a>
        <a href="tel:+6581273530">
          <img src={process.env.PUBLIC_URL + '/assets/icon/linkedin_blue.png'} alt="LinkedIn" className="icon" />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer"> {/* Placeholder for Instagram */}
          <img src={process.env.PUBLIC_URL + '/assets/icon/instagram_square_white.png'} alt="Instagram" className="icon" />
        </a>
      </motion.div>

      {/* CV Download Section */}
      <motion.div className="footer-cv-section" {...footerAnimate} transition={{...footerAnimate.transition, delay: 0.4}}>
        <motion.a
          className="download-button"
          href="/assets/documents/LeeChengZhan_Resume_Mar2023.docx"
          download
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Download CV
        </motion.a>
      </motion.div>

      {/* Copyright */}
      <motion.div 
        className="copyright"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <p>Copyright &copy; {new Date().getFullYear()} Lee Cheng Zhan. All Rights Reserved.</p>
      </motion.div>

    </footer>
  );
};

export default Footer;