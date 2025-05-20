import React from "react";
import { motion } from "framer-motion";
import "./Footer.css";

function Footer() {
  return (
    <footer>
      <section className="footer-flex-container" id="contact">
        <div className="contact-container">
        <motion.h2
            className="contact-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.3 }}
        >
            Contact
        </motion.h2>
        <motion.div
            className="contact"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.6 }}
            >
            <p>Email - Leechengzhan7@gmail.com</p>
            <p>Phone - +65 8127 3530</p>
        </motion.div>
        </div>
        <motion.div 
            className="cv-download-container"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.6 }}
        >
        <motion.a
            className="download-button"
            href="/assets/documents/LeeChengZhan_Resume_Mar2023.docx"
            download
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 250 }}
        >
            Download CV 
        </motion.a>
        </motion.div>
      </section>
      <div className="copyright">
        <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.6 }}
        >
            Copyright &copy; Lee Cheng Zhan
        </motion.p>
      </div>
    </footer>
  );
}

export default Footer;