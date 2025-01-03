import React from "react";
import './Footer.css';

function Footer(){
    return(
        <footer>
            <section className="footer-flex-container" id='contact'>
                <div className="contact-container">
                    <p className="contact-header">Contact</p>
                    <div className="contact">
                        <p>Email - Leechengzhan7@gmail.com</p>
                        <p>Phone - +65 8127 3530</p>
                    </div>
                </div>
                <div className="cv-download-container">
                    <button className='download-button'>Download CV</button>
                </div>
            </section>
            <div class="copyright">
                 <p>Copyright &copy; Lee Cheng Zhan</p>
            </div>
        </footer>
    );
};
  
export default Footer;