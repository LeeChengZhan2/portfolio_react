import './App.css';
import About from './components/About/About';
import Header from './components/Header/Header';
import Home from './components/Home/Home';
import Portfolio from './components/Portfolio/Portfolio';
import Footer from './components/Footer/Footer';
import SmoothScroll from './components/SmoothScroll/SmoothScroll';

function App() {
  return (
    <SmoothScroll>
      <div className="App">
        <Header />
        <Home />
        <About />
        <Portfolio />
        <Footer />
      </div>
    </SmoothScroll>
  );
}

export default App;
