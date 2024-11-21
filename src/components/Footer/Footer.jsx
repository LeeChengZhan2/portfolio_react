import React from "react";
import './Footer.css';

function Footer(){
    return(
        <footer className="footer-container">
            <section className="footer-flex-container">
                <div className="contact-container">
                    <p className="contact-header">Contact</p>
                    <div classNae="contact">
                        <p>Email - Leechengzhan7@gmail.com</p>
                        <p>Phone - +65 8127 3530</p>
                    </div>
                </div>
                <div className="cv-download-container">
                    <button className='download-button'>Download CV</button>
                </div>
            </section>
        </footer>
    );
};
  
export default Footer;