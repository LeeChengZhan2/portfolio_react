import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { enter, delay, hoverSpring, viewportOnce } from '../../motionConfig';
import './Footer.css';

const Footer = () => {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => {
      setCopied(null);
    }, 1000);
  };

  // Animation helpers
  const fadeIn = (d = null, t = enter.block) => ({
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: viewportOnce,
    transition: { ...t, ...(d ? { delay: d } : {}) },
  });

  const rise = (d = null, t = enter.text) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { ...t, ...(d ? { delay: d } : {}) },
  });

  return (
    <footer className="footer" id="contact">

      {/* Static Contact Info */}
      <motion.div className="footer-contact-text" {...fadeIn()}>
        <div className="email-container">
          <p>LeeChengZhan7@gmail.com</p>
          <img
            src={process.env.PUBLIC_URL + '/assets/icon/copy.png'}
            alt="Copy email"
            className="copy-icon"
            onClick={() => handleCopy('leechengzhan7@gmail.com', 'email')}
          />
          {copied === 'email' && <span className="copied-message">Copied!</span>}
        </div>
        <div className="numbers-wrapper">
          <div className="number-container">
            <p>SG: +65 81273530</p>
            <img
              src={process.env.PUBLIC_URL + '/assets/icon/copy.png'}
              alt="Copy SG number"
              className="copy-icon"
              onClick={() => handleCopy('+65 81273530', 'sg')}
            />
            {copied === 'sg' && <span className="copied-message">Copied!</span>}
          </div>
          <span className="separator">|</span>
          <div className="number-container">
            <p>MY: +60 183221917</p>
            <img
              src={process.env.PUBLIC_URL + '/assets/icon/copy.png'}
              alt="Copy MY number"
              className="copy-icon"
              onClick={() => handleCopy('+60 183221917', 'my')}
            />
            {copied === 'my' && <span className="copied-message">Copied!</span>}
          </div>
        </div>
      </motion.div>

      {/* Clickable Icons (first row) */}
      <motion.div className="footer-clickable-icons" {...fadeIn(delay.sm)}>
        <a href="mailto:leechengzhan7@gmail.com" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/gmail-colourful.png'} alt="Email" className="icon" />
        </a>
        <a href="tel:+6581273530" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/phone-blue.png'} alt="Phone" className="icon" />
        </a>
        <a href="https://wa.me/6581273530" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/whatsapp-circle-black.png'} alt="WhatsApp" className="icon" />
        </a>
        <a href="https://github.com/LeeChengZhan2" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/github-black.png'} alt="Github" className="icon" />
        </a>
        <a href="https://www.linkedin.com/in/cheng-zhan-lee-a87959220" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/linkedin-blue.png'} alt="LinkedIn" className="icon" />
        </a>
        <a href="https://www.instagram.com/aaaaaaazhan/?next=%2F" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/instagram-square-white.png'} alt="Instagram" className="icon" />
        </a>
      </motion.div>

      <motion.div className="footer-broker-icons" {...fadeIn(delay.sm)}>
        <a className="broker-item" href="https://www.moomoo.com/" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/moomoo-horizon.png'} alt="Moomoo" className="broker-icon" />
        </a>
        <a className="broker-item" href="https://www.etoro.com/people/chengzhanlee" target="_blank" rel="noreferrer">
          <img src={process.env.PUBLIC_URL + '/assets/icon/etoro-horizon.png'} alt="eToro" className="broker-icon" />
        </a>
      </motion.div>

      {/* CV Download Section */}
      <motion.div className="footer-cv-section" {...fadeIn(delay.md)}>
        <motion.a
          className="download-button"
          href="/assets/documents/leechengzhan-resume-mar-2023.docx"
          download
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={hoverSpring}
        >
          Download CV
        </motion.a>
      </motion.div>

      {/* Copyright */}
      <motion.div className="copyright" {...rise(delay.md)}>
        <p>Copyright &copy; {new Date().getFullYear()} Lee Cheng Zhan. All Rights Reserved.</p>
      </motion.div>

    </footer>
  );
};

export default Footer;
