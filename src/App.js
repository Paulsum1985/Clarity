import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, signInAnonymously, GoogleAuthProvider, signOut, TwitterAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ArrowLeft, Plus, Trash2, Share2, Check, Users, Star, Frown, Award, X, Zap, Crown, LogOut, User, ChevronDown, ArrowRight, Settings, ArrowUpCircle, LayoutGrid } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDZZPUyhR551iIZZhtVaBjVOoijWqb6F_4",
  authDomain: "clarity-polls.firebaseapp.com",
  projectId: "clarity-polls",
  storageBucket: "clarity-polls.firebasestorage.app",
  messagingSenderId: "403675966419",
  appId: "1:403675966419:web:a39f0245cef94cb34b5d26",
  measurementId: "G-NYY535SSGM"
};

const appId = 'clarity-app-local';

// Initialize Stripe outside of the component render
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);


// --- 1. UTILITY & HELPER COMPONENTS ---

const LoadingScreen = ({ message }) => (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-300">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg tracking-widest font-light">{message}</p>
    </div>
);

const GlassCard = ({ children, className = '' }) => (
    <div className={`bg-black/40 backdrop-blur-2xl p-6 md:p-8 rounded-2xl shadow-2xl border border-white/10 ${className}`} style={{'--tw-shadow-color': 'rgba(192, 132, 252, 0.1)', boxShadow: '0 0 60px var(--tw-shadow-color)'}}>
        {children}
    </div>
);

const ErrorScreen = ({ message, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-pink-300 p-4 text-center">
        <Frown size={64} className="mb-4 text-pink-500" />
        <h1 className="text-3xl font-bold text-white font-brand">Oops! Something went wrong.</h1>
        <p className="mt-2 text-lg">{message}</p>
        <button onClick={() => navigate('home')} className="mt-8 bg-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-pink-700 transition-colors">
            Go to Homepage
        </button>
    </div>
);

const ParticleBackground = () => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let particles = [];
        const particleCount = 200;
        const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        class Particle {
            constructor() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 2 + 0.5; this.speedX = (Math.random() - 0.5) * 0.15; this.speedY = (Math.random() - 0.5) * 0.15; const colors = ['#ffffff', '#add8e6', '#87ceeb', '#ffd700']; this.color = colors[Math.floor(Math.random() * colors.length)]; this.opacity = Math.random() * 0.7 + 0.1; }
            update() { this.x += this.speedX; this.y += this.speedY; if (this.x < 0) this.x = canvas.width; if (this.x > canvas.width) this.x = 0; if (this.y < 0) this.y = canvas.height; if (this.y > canvas.height) this.y = 0; }
            draw() { ctx.save(); ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.globalAlpha = this.opacity; if (this.color === '#ffd700') { ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'; } else { ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255, 255, 255, 0.25)'; } ctx.fill(); ctx.restore(); }
        }
        const init = () => { particles = []; for (let i = 0; i < particleCount; i++) { particles.push(new Particle()); } };
        const animate = () => { if(!canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); for (let i = 0; i < particles.length; i++) { particles[i].update(); particles[i].draw(); } animationFrameId = requestAnimationFrame(animate); };
        resizeCanvas(); init(); animate();
        const handleResize = () => { resizeCanvas(); init(); }
        window.addEventListener('resize', handleResize);
        return () => { window.cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
    }, []);
    return <canvas ref={canvasRef} className="w-full h-full"></canvas>;
};

const Background = () => (
    <div className="fixed top-0 left-0 w-full h-full -z-10 bg-slate-900">
        <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="absolute inset-0"><ParticleBackground /></div>
    </div>
);

const LoginModal = ({ auth, onClose }) => {
    const handleSignIn = async (provider) => {
        try {
            await signInWithPopup(auth, provider);
            onClose();
        } catch (error) {
            console.error("Sign-in error:", error.code, error.message);
        }
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <GlassCard className="w-full max-w-sm text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
                <h1 className="text-4xl font-bold text-white mb-2 font-brand">Welcome to Clarity</h1>
                <p className="text-slate-300 mb-8">Sign in to start making better decisions.</p>
                <div className="space-y-4">
                    <button onClick={() => handleSignIn(new GoogleAuthProvider())} className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6"/>Sign in with Google</button>
<button onClick={() => handleSignIn(new TwitterAuthProvider())} className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
   Sign in with X
</button>
                </div>
             </GlassCard>
        </div>
    );
};

const AnimatedResultsDemo = () => {
    const demoPoll = useMemo(() => ({
        question: 'Where should we go for dinner?',
        scores: [
            { id: 'opt_1', name: 'Sushi Samba', score: 32 },
            { id: 'opt_2', name: 'The Italian Place', score: 25 },
            { id: 'opt_3', name: 'Vegan Burger Joint', score: 18 },
        ]
    }), []);
    const maxScore = demoPoll.scores[0].score;
    const barGradients = [ 'from-green-400 to-cyan-400', 'from-blue-400 to-purple-500', 'from-purple-500 to-pink-500' ];
    const glowEffects = [ '0 0 10px #2dd4bf', '0 0 10px #a78bfa', '0 0 10px #f472b6' ];
    return (
        <GlassCard>
            <div className="text-center mb-6">
    <h3 className="text-xl md:text-2xl font-bold text-white font-brand">{demoPoll.question}</h3>
</div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white font-brand">Results</h2><div className="flex items-center gap-2 text-slate-400 bg-white/10 px-3 py-1 rounded-full"><Users size={16} /><span className="font-semibold">8</span></div></div>
            <div className="space-y-4">
                {demoPoll.scores.map((option, index) => (
                    <div key={option.id} className="animate-fade-in" style={{animationDelay: `${0.5 + index * 0.2}s`}}>
                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-lg text-white truncate pr-2" title={option.name}>
                                    {index === 0 && <Award className="inline-block mr-2 -mt-1 text-yellow-400" size={18} />}
                                    <span className="font-bold">{index + 1}.</span> {option.name}
                                </p>
                            </div>
                            <p className="font-bold text-white text-lg">{option.score}</p>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-4">
                            <div className={`rounded-full h-4 transition-all duration-500 ease-out bg-gradient-to-r ${barGradients[index]}`} style={{ width: `${(option.score / maxScore) * 100}%`, animation: `bar-animate 1s ${0.5 + index * 0.2}s ease-out forwards`, transform: 'scaleX(0)', transformOrigin: 'left', boxShadow: glowEffects[index] }}></div>
                        </div>
                    </div>
                ))}
                 <div className="mt-2 text-center text-sm text-cyan-300 font-semibold animate-fade-in relative" style={{animationDelay: '1.2s'}}>22% Clarity</div>
            </div>
        </GlassCard>
    )
};
const UserMenu = ({ user, auth, navigate, userStatus, onSignIn }) => {
    const [isOpen, setIsOpen] = useState(false);
    const handleSignOut = async () => { await signOut(auth); navigate('home'); };

    const handleManageSubscription = async () => {
        const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:4242';
        try {
            const response = await fetch(`${serverUrl}/create-customer-portal-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid }),
            });

            if (!response.ok) throw new Error('Failed to create customer portal session');
            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('Error managing subscription:', error);
        }
    };
    
    if(!user || user.isAnonymous) { return ( <div className="absolute top-6 right-6 z-30"><button onClick={onSignIn} className="bg-white/10 text-white font-semibold py-2 px-4 rounded-full hover:bg-white/20 transition-colors">Sign In</button></div> ) }
    return (
        <div className="absolute top-6 right-6 z-30">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-white/10 p-2 rounded-full">
                {user.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" /> : <User className="w-8 h-8 p-1"/>}
                <span className="font-semibold hidden sm:inline">{user.displayName || 'User'}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-lg py-1">
                      {userStatus && <div className="px-4 py-2 text-xs text-purple-400 uppercase font-bold">{userStatus.tier} Plan</div>}
                      <button onClick={() => {navigate('my-decisions'); setIsOpen(false);}} className="flex items-center gap-2 w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700"><LayoutGrid size={16}/>My Decisions</button>
                    {userStatus && userStatus.tier === 'pro' && (
                          <button onClick={handleManageSubscription} className="flex items-center gap-2 w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700"><Settings size={16} /> Manage Subscription</button>
                      )}
                    {userStatus && userStatus.tier === 'free' && <button onClick={() => {navigate('pricing'); setIsOpen(false);}} className="flex items-center gap-2 w-full text-left px-4 py-2 text-purple-400 hover:bg-slate-700"><ArrowUpCircle size={16}/>Upgrade</button>}
                    <button onClick={handleSignOut} className="flex items-center gap-2 w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700"><LogOut size={16}/>Sign Out</button>
                </div>
            )}
        </div>
    )
};

const HomePage = ({ navigate, user, auth, userStatus }) => {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const handleMakeDecisionClick = () => { user && !user.isAnonymous ? navigate('create') : setShowLoginModal(true); };
    return (
        <>
            {showLoginModal && <LoginModal auth={auth} onClose={() => setShowLoginModal(false)} />}
            <div className="flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden">
                <UserMenu user={user} auth={auth} navigate={navigate} userStatus={userStatus} onSignIn={() => setShowLoginModal(true)} />
                <div className="text-center">
    <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter font-brand animate-fade-in" style={{ textShadow: '0 0 10px rgba(255,255,255,0.2), 0 0 25px rgba(236,72,153,0.3), 0 0 40px rgba(168,85,247,0.3)' }}>Clarity</h1>
    <p className="mt-3 text-base md:text-lg text-slate-200 max-w-xl animate-fade-in delay-1" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>Make better decisions, together. Turn confusing choices into clear, objective results.</p>
</div>
                <div className="mt-8 animate-fade-in delay-2">
                    <button onClick={handleMakeDecisionClick} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-10 rounded-full text-lg shadow-[0_5px_15px_rgba(236,72,153,0.4),_inset_0_-2px_5px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(236,72,153,0.5),_inset_0_-2px_5px_rgba(0,0,0,0.4)] active:shadow-[0_2px_5px_rgba(236,72,153,0.3),_inset_0_-1px_3px_rgba(0,0,0,0.4)] transition-all duration-150 transform hover:-translate-y-1 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50">
                        Make a Decision
                    </button>
                </div>
                <div className="mt-16 w-full max-w-6xl mx-auto animate-fade-in delay-3">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>Go Beyond Simple Polls</h2>
                        <p className="text-base text-slate-300 mt-2 max-w-2xl mx-auto">Find a definitive, data-driven answer that your whole team can feel confident in.</p>
                    </div>
                    <div className="max-w-xl mx-auto"><AnimatedResultsDemo /></div>
                    </div>

{/* Product Hunt Badge */}
<div className="mt-16 flex justify-center animate-fade-in delay-2">
    <a href="https://www.producthunt.com/products/clarity-13?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-clarity--c0df8d3b--f4ff--4ae9--9be1--6286eb7b291f" target="_blank" rel="noopener noreferrer">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=982522&theme=neutral&t=1750776570386" alt="Clarity - Group decision-making, clarified. | Product Hunt" style={{width: '250px', height: '54px'}} width="250" height="54" />
    </a>
</div>
                <div className="mt-16 text-center text-slate-300 w-full max-w-5xl">
                    <h2 className="text-2xl font-bold text-white mb-6 animate-fade-in" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>How It Works</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[ { title: "1. Frame", description: "Ask your question and list the options you're choosing between." }, { title: "2. Define", description: "List the criteria that matter for the decision, like 'Cost' or 'Quality'." }, { title: "3. Rate & Decide", description: "Share a link, have everyone rate the options, and see the best choice emerge." } ].map((step, index) => (
                            <div key={index} className="relative overflow-hidden bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg group transition-all duration-300 transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-in-out"></div>
                                <div className="relative p-6 text-center">
                                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2 font-brand group-hover:text-white group-hover:bg-none transition-colors duration-300" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{step.title}</div>
                                    <p className="text-slate-300 group-hover:text-white transition-colors duration-300">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

// --- Page Components ---

// NEW: CheckoutModal Component
const CheckoutModal = ({ clientSecret, onClose }) => {
    if (!clientSecret) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-lg relative">
                <button onClick={onClose} className="absolute -top-4 -right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full p-1 z-10"><X size={24}/></button>
                <div id="checkout">
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
            </div>
        </div>
    );
};

const WeightSelector = ({ value, onChange }) => {
    const weights = [1, 2, 3];
    return (
        <div className="flex items-center gap-2 bg-white/10 p-1 rounded-md">
            {weights.map(w => (
                <button
                    key={w}
                    type="button"
                    onClick={() => onChange(w)}
                    className={`px-3 py-1 text-sm rounded ${value === w ? 'bg-purple-500 text-white' : 'text-slate-300 hover:bg-white/20'}`}
                >
                    {w}x
                </button>
            ))}
        </div>
    );
};


const CreateDecisionPage = ({ db, user, userStatus, setUserStatus, navigate }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [criteria, setCriteria] = useState([{ name: '', weight: 1 }]);
    const [isCreating, setIsCreating] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    
    const handleCriteriaChange = (index, field, value) => {
        const newCriteria = [...criteria];
        newCriteria[index][field] = value;
        setCriteria(newCriteria);
    };

    const addCriterion = () => setCriteria(prev => [...prev, { name: '', weight: 1 }]);
    const removeCriterion = (index) => setCriteria(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    
    const checkUsageLimit = () => {
        if (userStatus.tier === 'pro') return true;
        const today = new Date().toISOString().slice(0, 10);
        if (userStatus.lastDecisionDate !== today) {
            return true; // First decision of a new day
        }
        return userStatus.decisionCountToday < 1; // Limit to 1 per day
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!checkUsageLimit()) {
            setShowUpgradeModal(true);
            return;
        }

        const finalOptions = options.map((o, i) => ({ id: `opt_${i}`, name: o.trim() })).filter(o => o.name);
        let finalCriteria = criteria.map((c, i) => ({ id: `crit_${i}`, name: c.name.trim(), weight: c.weight })).filter(c => c.name);

        // If no criteria are entered, create a standard poll
        if (finalCriteria.length === 0) {
            finalCriteria.push({ id: 'crit_0', name: 'Rating', weight: 1 });
        }
        
        if (!question.trim() || finalOptions.length < 2) return;
        setIsCreating(true);

        try {
            // Update user status in Firestore for free tier usage
            if (userStatus.tier === 'free') {
                const userStatusRef = doc(db, `artifacts/${appId}/users/${user.uid}/status`, 'main');
                const today = new Date().toISOString().slice(0, 10);
                const newStatus = { ...userStatus };
                if (newStatus.lastDecisionDate === today) {
                    newStatus.decisionCountToday += 1;
                } else {
                    newStatus.lastDecisionDate = today;
                    newStatus.decisionCountToday = 1;
                }
                await setDoc(userStatusRef, newStatus);
                setUserStatus(newStatus);
            }
            
            // Create decision
            const decisionData = { question: question.trim(), options: finalOptions, criteria: finalCriteria, creatorId: user.uid, createdAt: new Date().toISOString(), votes: [], deleted: false };
            const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/decisions`), decisionData);
            navigate('decision', docRef.id);
        } catch (error) {
            console.error("Error creating decision:", error);
            setIsCreating(false);
        }
    };
    
    return (
        <>
            {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} navigate={navigate}/>}
            <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fade-in">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => navigate('my-decisions')} className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"><ArrowLeft size={18} /> Back to My Decisions</button>
                    <GlassCard>
                        <h1 className="text-4xl font-bold text-white mb-2 font-brand">Create a New Decision</h1>
                        <p className="text-slate-400 mb-8">Follow the steps to get clarity on your choice.</p>
                        <form onSubmit={handleSubmit} className="space-y-10">
                            <div>
                                <label className="block text-xl font-semibold text-white mb-3">1. What's the decision?</label>
                                <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g., Where to go for our team dinner?" className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all placeholder-slate-400" required />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white mb-3">2. What are the options?</h2>
                                <div className="space-y-3">
                                    {options.map((option, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <input type="text" value={option} onChange={(e) => setOptions(prev => { const newO = [...prev]; newO[index] = e.target.value; return newO; })} placeholder={`Option ${index + 1}`} className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all placeholder-slate-400" required />
                                            <button type="button" onClick={() => setOptions(prev => prev.length > 2 ? prev.filter((_, i) => i !== index) : prev)} disabled={options.length <= 2}><Trash2 size={20} className={`transition-colors ${options.length > 2 ? 'text-slate-400 hover:text-pink-500' : 'text-slate-600 cursor-not-allowed'}`} /></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setOptions(prev => [...prev, ''])} className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold py-2 transition-colors"><Plus size={18} /> Add another option</button>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white mb-3">3. What are the criteria? <span className="text-sm text-slate-400 font-light">(Optional)</span></h2>
                                {userStatus?.tier === 'pro' && (
                                    <p className="text-sm text-slate-400 -mt-2 mb-3">As a Pro user, you can assign weights to make some criteria more important than others.</p>
                                )}
                                <div className="space-y-3">
                                    {criteria.map((criterion, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <input type="text" value={criterion.name} onChange={(e) => handleCriteriaChange(index, 'name', e.target.value)} placeholder={`Criterion ${index + 1} (e.g., Taste, Price)`} className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all placeholder-slate-400" />
                                            {userStatus?.tier === 'pro' && <WeightSelector value={criterion.weight} onChange={(w) => handleCriteriaChange(index, 'weight', w)} />}
                                            <button type="button" onClick={() => removeCriterion(index)} disabled={criteria.length <= 1}><Trash2 size={20} className={`transition-colors ${criteria.length > 1 ? 'text-slate-400 hover:text-pink-500' : 'text-slate-600 cursor-not-allowed'}`} /></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addCriterion} className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold py-2 transition-colors"><Plus size={18} /> Add another criterion</button>
                                </div>
                            </div>
                            <div className="pt-4">
    <p className="text-center text-slate-400 text-sm mb-4">
        Don't worry, anyone you share this link with can vote without needing an account.
    </p>
    <button type="submit" disabled={isCreating} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 px-8 rounded-lg text-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-wait">
        {isCreating ? 'Creating...' : 'Create & Get Link'}
    </button>
</div>
                        </form>
                    </GlassCard>
                </div>
            </div>
        </>
    );
};

const PricingPage = ({ db, user, navigate, setUserStatus, userStatus }) => {
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [clientSecret, setClientSecret] = useState('');
    const [billingCycle, setBillingCycle] = useState('monthly');

    // IMPORTANT: Replace these with your actual Price IDs from your Stripe Dashboard
    const priceIds = {
      monthly: 'price_1Rd4DjHaGhXNZS1MB4VvN3hu',
      sixMonth: 'price_1Rd4EcHaGhXNZS1MACPiQ2vY',
      yearly: 'pprice_1Rd4F2HaGhXNZS1MH4jWAZgO',
    };

    const handleUpgrade = async () => {
        setIsUpgrading(true);
        const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:4242';
        try {
            const response = await fetch(`${serverUrl}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ userId: user.uid, priceId: priceIds[billingCycle] }),
            });

            if (!response.ok) throw new Error('Failed to create checkout session');

            const { clientSecret } = await response.json();
            setClientSecret(clientSecret);
            setShowCheckout(true);

        } catch (error) {
            console.error("Error upgrading:", error);
        } finally {
            setIsUpgrading(false);
        }
    };

    const pricingOptions = {
        monthly: { price: '1.99', interval: 'month' },
        sixMonth: { price: '9.00', interval: '6 months' },
        yearly: { price: '15.00', interval: 'year' },
    };
    
    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fade-in">
             {showCheckout && <CheckoutModal clientSecret={clientSecret} onClose={() => setShowCheckout(false)} />}
             <button onClick={() => navigate('my-decisions')} className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors absolute top-6 left-6"><ArrowLeft size={18} /> Back to My Decisions</button>
            <div className="max-w-4xl mx-auto text-center pt-16">
                <h1 className="text-5xl font-bold text-white mb-4 font-brand">Choose Your Plan</h1>
                <p className="text-slate-400 mb-12 max-w-2xl mx-auto">Unlock the full power of Clarity and make unlimited decisions. Start with our free plan and upgrade anytime.</p>
                
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Free Plan */}
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-lg text-left flex flex-col">
                        <h2 className="text-3xl font-bold font-brand text-white">Free</h2>
                        <p className="text-slate-400 mt-2">For occasional decisions</p>
                        <p className="text-4xl font-bold text-white mt-6">£0</p>
                        <ul className="mt-8 space-y-4 text-slate-300 flex-grow">
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> 1 decision per day</li>
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Unlimited participants</li>
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Real-time results</li>
                        </ul>
                        <button disabled className="w-full mt-10 bg-white/10 text-white/50 font-semibold py-3 rounded-lg">Current Plan</button>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-purple-600/10 backdrop-blur-xl p-8 rounded-2xl border border-purple-400/30 shadow-2xl text-left flex flex-col" style={{'--tw-shadow-color': 'rgba(192, 132, 252, 0.3)', boxShadow: '0 0 60px var(--tw-shadow-color)'}}>
                        <h2 className="text-3xl font-bold font-brand text-white">Pro</h2>
                        <p className="text-purple-300 mt-2">For teams & power users</p>

                        <div className="flex items-baseline mt-6">
                            <p className="text-4xl font-bold text-white">£{pricingOptions[billingCycle].price}</p>
                            <span className="text-lg font-normal text-slate-400 ml-2">/ {pricingOptions[billingCycle].interval}</span>
                        </div>

                        <div className="my-6 flex justify-center bg-black/20 rounded-lg p-1">
                            {Object.keys(pricingOptions).map(cycle => (
                                <button key={cycle} onClick={() => setBillingCycle(cycle)} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${billingCycle === cycle ? 'bg-purple-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}>
                                    {cycle === 'monthly' && 'Monthly'}
                                    {cycle === 'sixMonth' && '6 Months'}
                                    {cycle === 'yearly' && 'Yearly'}
                                </button>
                            ))}
                        </div>
                        
                        <ul className="space-y-4 text-slate-300 flex-grow">
                             <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> <span className="font-bold">Unlimited</span> decisions</li>
                             <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Weighted criteria</li>
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Unlimited participants</li>
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Real-time results</li>
                            <li className="flex items-center gap-3"><Check className="text-green-400" size={20}/> Priority support</li>
                        </ul>
                        <button onClick={handleUpgrade} disabled={isUpgrading} className="w-full mt-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg text-lg shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] transition-all duration-300 disabled:opacity-50">
                            {isUpgrading ? "Upgrading..." : "Upgrade to Pro"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DecisionPage = ({ db, user, auth, decisionId, navigate }) => {
    const [decision, setDecision] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const userId = user ? user.uid : null;

    useEffect(() => {
        if (!db || !decisionId) return;
        setLoading(true);
        const docPath = `artifacts/${appId}/public/data/decisions/${decisionId}`;
        const unsubscribe = onSnapshot(doc(db, docPath), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.deleted) {
                    setError("The creator of this poll has deleted it.");
                    setDecision(null);
                } else {
                    setDecision({ id: docSnap.id, ...data });
                    setError(null);
                }
            } else { setError("Decision not found."); setDecision(null); }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching decision:", err);
            setError("Could not load decision data.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db, decisionId]);

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (loading) return <LoadingScreen message="Loading decision..." />;
    if (error) return <ErrorScreen message={error} navigate={navigate} />;
    if (!decision) return null;

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto">
                <button onClick={() => navigate('my-decisions')} className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors"><ArrowLeft size={18} /> Back to My Decisions</button>
                <header className="bg-black/30 backdrop-blur-xl p-6 rounded-2xl shadow-lg mb-8 border border-white/20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <p className="text-slate-400 text-sm font-semibold tracking-wider">THE QUESTION</p>
                            <h1 className="text-2xl md:text-3xl font-bold text-white font-brand">{decision.question}</h1>
                        </div>
                        <button onClick={handleCopyLink} className="flex items-center gap-2 bg-white/10 text-cyan-300 font-semibold py-2 px-4 rounded-full hover:bg-white/20 transition-colors border border-cyan-300/30">
                            {copied ? <Check size={20} /> : <Share2 size={20} />}
                            {copied ? 'Link Copied!' : 'Share'}
                        </button>
                    </div>
                </header>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <main className="lg:col-span-3"><VotingInterface decision={decision} db={db} userId={userId} auth={auth} /></main>
                    <aside className="lg:col-span-2"><ResultsPanel decision={decision} /></aside>
                </div>
            </div>
        </div>
    );
};

const MyDecisionsPage = ({ db, user, navigate }) => {
    const [decisions, setDecisions] = useState([]);
    const [loading, setLoading] = useState(true);

    const exampleDecisions = [
        "What takeaway should we get tonight?",
        "Which movie should we see on Saturday?",
        "Where should we go for our next team lunch?",
        "What should be our top priority for the next sprint?",
        "Which design concept is the strongest?",
        "What's the best name for our new project?"
    ];

    useEffect(() => {
        if (!db || !user) return;
        if (user.isAnonymous) {
            setDecisions([]);
            setLoading(false);
            return;
        }

        const decisionsRef = collection(db, `artifacts/${appId}/public/data/decisions`);
        const q = query(decisionsRef, where("creatorId", "==", user.uid), where("deleted", "==", false));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const userDecisions = [];
            querySnapshot.forEach((doc) => {
                userDecisions.push({ id: doc.id, ...doc.data() });
            });
            setDecisions(userDecisions.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user decisions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, user]);

    const handleDelete = async (decisionId) => {
        if (window.confirm("Are you sure you want to delete this decision? This action cannot be undone.")) {
            const decisionRef = doc(db, `artifacts/${appId}/public/data/decisions`, decisionId);
            try {
                await updateDoc(decisionRef, { deleted: true });
            } catch (error) {
                console.error("Error deleting decision:", error);
            }
        }
    };
    
    if (loading) {
        return <LoadingScreen message="Fetching your decisions..." />;
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fade-in">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                    <button onClick={() => navigate('home')} className="flex items-center gap-2 text-slate-300 hover:text-white mb-2 transition-colors mx-auto"><ArrowLeft size={18} /> Back to Home</button>
                    <h1 className="text-4xl font-bold text-white font-brand">My Decisions</h1>
                    <p className="text-slate-400 mt-2">Here are all the decisions you've created. Click on one to view the results or continue voting.</p>
                </div>
                
                <div className="flex justify-center my-6">
                    <button onClick={() => navigate('create')} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-10 rounded-full text-lg shadow-[0_5px_15px_rgba(236,72,153,0.4),_inset_0_-2px_5px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(236,72,153,0.5),_inset_0_-2px_5px_rgba(0,0,0,0.4)] active:shadow-[0_2px_5px_rgba(236,72,153,0.3),_inset_0_-1px_3px_rgba(0,0,0,0.4)] transition-all duration-150 transform hover:-translate-y-1 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50 flex items-center gap-2">
                        <Plus size={20} /> New Decision
                    </button>
                </div>

                {decisions.length === 0 && !loading ? (
                    <GlassCard>
                        <div className="text-center py-8">
                          <h2 className="text-2xl font-bold text-white mb-4">No Decisions Yet!</h2>
                          <p className="text-slate-400 mb-6">Get started by creating your first poll. Here are some ideas:</p>
                          <ul className="space-y-3 text-slate-300">
                            {exampleDecisions.map((ex, i) => (
                                <li key={i} className="flex items-center justify-center gap-3">
                                    <Zap size={14} className="text-yellow-400" />
                                    <span>{ex}</span>
                                </li>
                            ))}
                          </ul>
                        </div>
                    </GlassCard>
                ) : (
                    <div className="space-y-4">
                        {decisions.map(decision => (
                             <GlassCard key={decision.id} className="!p-0 overflow-hidden hover:border-cyan-400/50 transition-colors duration-300 group relative">
                                <button onClick={() => navigate('decision', decision.id)} className="w-full text-left p-6 pr-16">
                                    <h2 className="text-xl font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">{decision.question}</h2>
                                    <div className="flex flex-wrap items-center text-sm text-slate-400 mt-2 gap-x-4 gap-y-1">
                                        <span>{new Date(decision.createdAt).toLocaleDateString()}</span>
                                        <span>&bull;</span>
                                        <span>{decision.options.length} options</span>
                                        <span>&bull;</span>
                                        <span>{decision.criteria.length} criteria</span>
                                        <span>&bull;</span>
                                        <span>{decision.votes.length} votes</span>
                                    </div>
                                </button>
                                <button onClick={() => handleDelete(decision.id)} className="absolute top-0 right-0 p-6 text-slate-400 hover:text-pink-500 transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const UpgradeModal = ({ onClose, navigate }) => ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"> <GlassCard className="w-full max-w-md text-center"> <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button> <div className="text-yellow-400 mb-4"><Zap size={48} className="mx-auto"/></div> <h2 className="text-2xl font-bold text-white mb-2 font-brand">Daily Limit Reached</h2> <p className="text-slate-300 mb-6">You've used your free decision for today. Upgrade to Clarity Pro for unlimited decisions and more.</p> <button onClick={() => navigate('pricing')} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg text-lg">Upgrade to Pro</button> </GlassCard> </div> );

const ResultsPanel = ({ decision }) => {
    const { options, criteria, votes } = decision;
    const [activeTooltip, setActiveTooltip] = useState(null);

    const { scores, clarityScore } = useMemo(() => {
        const calculatedScores = options.map(option => {
            let totalScore = 0;
            const breakdown = criteria.map(criterion => {
                // For each option, sum the ratings for this criterion across all votes, multiplied by the criterion's weight
                const criterionScore = votes.reduce((sum, vote) => {
                    const rating = vote.ratings[option.id]?.[criterion.id] || 0;
                    return sum + rating;
                }, 0);
                const weightedScore = criterionScore * criterion.weight;
                totalScore += weightedScore;
                return { name: criterion.name, score: weightedScore, weight: criterion.weight };
            });
            return { ...option, score: totalScore, breakdown };
        });
        
        calculatedScores.sort((a, b) => b.score - a.score);
        
        let clarity = 0;
        if (calculatedScores.length > 1 && calculatedScores[0].score > 0) {
            const winnerScore = calculatedScores[0].score;
            const runnerUpScore = calculatedScores[1].score;
            clarity = Math.round(((winnerScore - runnerUpScore) / winnerScore) * 100);
        } else if (calculatedScores.length === 1 && calculatedScores[0].score > 0) {
            clarity = 100;
        }
        return { scores: calculatedScores, clarityScore: clarity };
    }, [options, criteria, votes]);

    const [previousWinnerId, setPreviousWinnerId] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (scores.length > 0 && scores[0].score > 0) {
            const currentWinnerId = scores[0].id;
            if (currentWinnerId !== previousWinnerId) {
                setShowConfetti(true);
                const timer = setTimeout(() => setShowConfetti(false), 2000);
                setPreviousWinnerId(currentWinnerId);
                return () => clearTimeout(timer);
            }
        }
    }, [scores, previousWinnerId]);
    
    const maxScore = scores.length > 0 && scores[0].score > 0 ? scores[0].score : 1;

    const isStandardPoll = criteria.length === 1 && criteria[0].name === 'Rating';

    return (
        <GlassCard className="sticky top-8" style={{'--tw-shadow-color': 'rgba(56, 189, 248, 0.1)', boxShadow: '0 0 60px var(--tw-shadow-color)'}}>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white font-brand">Results</h2><div className="flex items-center gap-2 text-slate-400 bg-white/10 px-3 py-1 rounded-full"><Users size={16} /><span className="font-semibold">{votes.length}</span></div></div>
            {votes.length === 0 ? ( <div className="text-center py-10"><p className="text-slate-400">No votes yet.</p><p className="text-slate-500 text-sm">Results will appear here in real-time.</p></div> ) : (
                <div className="space-y-4">
                    {scores.map((option, index) => (
                        <div key={option.id} className="relative" onMouseEnter={() => !isStandardPoll && setActiveTooltip(option.id)} onMouseLeave={() => setActiveTooltip(null)}>
                            <div className="flex justify-between items-baseline mb-1">
                                <p className="font-semibold text-lg text-white truncate pr-2" title={option.name}>
                                    {index === 0 && <Award className="inline-block mr-2 -mt-1 text-yellow-400" size={18} />}
                                    <span className="font-bold">{index + 1}.</span> {option.name}
                                </p>
                                <p className="font-bold text-white text-lg">{option.score}</p>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-4">
                                <div className={`rounded-full h-4 transition-all duration-500 ease-out bg-gradient-to-r ${index === 0 ? 'from-green-400 to-cyan-400' : 'from-purple-500 to-pink-500'}`} style={{ width: `${(option.score / maxScore) * 100}%`, boxShadow: index === 0 ? '0 0 10px #2dd4bf' : 'none' }}></div>
                            </div>
                            {index === 0 && clarityScore > 0 && ( <div className="mt-2 text-center text-sm text-cyan-300 font-semibold animate-fade-in relative">{clarityScore}% Clarity{showConfetti && <ConfettiExplosion />}</div> )}
                            {activeTooltip === option.id && ( <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs bg-black/80 backdrop-blur-sm text-white text-xs rounded-md p-3 z-20 shadow-lg animate-fade-in"><h4 className="font-bold text-sm mb-2 border-b border-white/20 pb-1">Score Breakdown</h4><ul className="space-y-1">{option.breakdown.map(b => <li key={b.name} className="flex justify-between gap-4"><span className="opacity-80">{b.name} (x{b.weight}):</span> <span className="font-bold">{b.score} pts</span></li>)}</ul></div> )}
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
};

const VotingInterface = ({ decision, db, userId, auth }) => {
    const { options, criteria, votes, id: decisionId } = decision;
    const currentUserVote = useMemo(() => votes.find(v => v.userId === userId), [votes, userId]);
    
    const isStandardPoll = criteria.length === 1 && criteria[0].name === 'Rating';

    const [myRatings, setMyRatings] = useState(() => {
        if (currentUserVote) return currentUserVote.ratings;
        const initial = {};
        options.forEach(o => {
            initial[o.id] = {};
            criteria.forEach(c => { initial[o.id][c.id] = 0; });
        });
        return initial;
    });

    useEffect(() => {
        if (currentUserVote) {
            setMyRatings(currentUserVote.ratings);
        }
    }, [currentUserVote]);

    const handleRatingChange = (optionId, criterionId, rating) => { setMyRatings(p => ({ ...p, [optionId]: { ...p[optionId], [criterionId]: rating } })); };
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmitVote = async () => {
        setIsSubmitting(true);
        try {
            let voterId = userId;
            // If there's no user ID, sign in anonymously to get one. This can happen if a user who is not logged in visits the page.
            if (!voterId) {
                const userCredential = await signInAnonymously(auth);
                voterId = userCredential.user.uid;
            }

            const docRef = doc(db, `artifacts/${appId}/public/data/decisions/${decisionId}`);
            const newVote = { userId: voterId, ratings: myRatings };
            
            await runTransaction(db, async (t) => {
                const sfDoc = await t.get(docRef);
                if (!sfDoc.exists()) throw "Document does not exist!";
                const currentVotes = sfDoc.data().votes || [];
                const existingVoteIndex = currentVotes.findIndex(v => v.userId === voterId);
                if (existingVoteIndex > -1) currentVotes[existingVoteIndex] = newVote;
                else currentVotes.push(newVote);
                t.update(docRef, { votes: currentVotes });
            });
        } catch (e) { console.error("Vote submission failed: ", e); } 
        finally { setIsSubmitting(false); }
    };

    const allRated = useMemo(() => options.every(o => criteria.every(c => myRatings[o.id]?.[c.id] > 0)), [myRatings, options, criteria]);

    return (
        <GlassCard className="!p-0 overflow-hidden">
            <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-1 font-brand">Your Turn to Rate</h2>
                <p className="text-slate-400 mb-6">{isStandardPoll ? "Rate each option from 1 to 5 stars." : "Rate each option from 1 to 5 stars for all criteria."}</p>
            </div>
            {isStandardPoll ? (
                 <div className="p-6 pt-0 space-y-4">
                    {options.map(option => (
                        <div key={option.id} className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
                            <span className="font-semibold text-white">{option.name}</span>
                            <StarRating rating={myRatings[option.id]?.[criteria[0].id] || 0} onRating={(r) => handleRatingChange(option.id, criteria[0].id, r)} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-white/5"><tr className="border-b-2 border-white/10"><th className="p-4 font-semibold text-slate-300">Options</th>{criteria.map(c => <th key={c.id} className="p-4 font-semibold text-slate-300 text-center min-w-[120px]">{c.name} (x{c.weight})</th>)}</tr></thead>
                        <tbody>
                            {options.map((option) => (
                                <tr key={option.id} className="border-b border-white/10 last:border-b-0">
                                    <td className="p-4 font-semibold text-white">{option.name}</td>
                                    {criteria.map(c => (<td key={c.id} className="p-4 text-center"><StarRating rating={myRatings[option.id]?.[c.id] || 0} onRating={(r) => handleRatingChange(option.id, c.id, r)} /></td>))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="p-6 mt-2">
                <button onClick={handleSubmitVote} disabled={isSubmitting || !allRated} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Submitting...' : (currentUserVote ? 'Update My Vote' : 'Submit My Vote')}
                </button>
                {!allRated && <p className="text-sm text-center mt-3 text-slate-500">Please rate all items to submit.</p>}
            </div>
        </GlassCard>
    );
};

const StarRating = ({ rating, onRating }) => ( <div className="flex justify-center items-center gap-1">{[1, 2, 3, 4, 5].map((star) => ( <Star key={star} onClick={() => onRating(star)} className={`cursor-pointer transition-all duration-150 ${rating >= star ? 'text-yellow-400 fill-current' : 'text-slate-600'} hover:text-yellow-300 hover:scale-125`} style={{ filter: rating >= star ? 'drop-shadow(0 0 5px #facc15)' : 'none' }} size={24} /> ))}</div> );

const ConfettiExplosion = ({ count = 100 }) => {
    const particles = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const angle = (i / count) * 360;
            const velocity = 80 + Math.random() * 50;
            const x = Math.cos(angle * (Math.PI / 180)) * velocity;
            const y = Math.sin(angle * (Math.PI / 180)) * velocity;
            const colors = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6'];
            return { color: colors[Math.floor(Math.random() * colors.length)], x, y, rotation: Math.random() * 360, delay: Math.random() * 0.2 };
        });
    }, [count]);
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {particles.map((p, i) => ( <div key={i} className="absolute w-2 h-2 particle" style={{ backgroundColor: p.color, '--x-end': `${p.x}px`, '--y-end': `${p.y}px`, transform: `rotate(${p.rotation}deg)`, animation: `confetti-fly 1s ${p.delay}s ease-out forwards` }} ></div> ))}
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [userStatus, setUserStatus] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [page, setPage] = useState('home');
    const [decisionId, setDecisionId] = useState(null);

    // --- Firebase Initialization ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            let userStatusUnsubscribe = () => {};

            const authUnsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
                userStatusUnsubscribe();

                if (firebaseUser) {
                    setUser(firebaseUser);
                    const userStatusRef = doc(firestoreDb, `artifacts/${appId}/users/${firebaseUser.uid}/status`, 'main');
                    userStatusUnsubscribe = onSnapshot(userStatusRef, (docSnap) => {
                        if (docSnap.exists()) {
                            setUserStatus(docSnap.data());
                        } else {
                            const newStatus = { tier: 'free', lastDecisionDate: '', decisionCountToday: 0 };
                            setDoc(userStatusRef, newStatus);
                            setUserStatus(newStatus);
                        }
                    }, (error) => {
                       console.error("Error in onSnapshot:", error);
                    });
                } else {
                    signInAnonymously(firebaseAuth).catch((error) => {
                        console.error("Anonymous sign-in failed:", error);
                    });
                }
                setIsAuthReady(true);
            }, (error) => {
               console.error("Error in onAuthStateChanged:", error);
               setIsAuthReady(true);
           });

            return () => {
                authUnsubscribe();
                userStatusUnsubscribe();
            };
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setIsAuthReady(true);
        }
    }, []);
    
    // --- Routing ---
    const navigate = useCallback((targetPage, id = null) => {
        if (targetPage === 'decision' && id) window.location.hash = `#decision/${id}`;
        else if (targetPage === 'create') window.location.hash = '#create';
        else if (targetPage === 'pricing') window.location.hash = '#pricing';
        else if (targetPage === 'my-decisions') window.location.hash = '#my-decisions';
        else window.location.hash = '#';
    }, []);
    
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash.startsWith('decision/')) {
                setDecisionId(hash.split('/')[1]);
                setPage('decision');
            } else if (hash === 'create') {
                if(user && !user.isAnonymous) setPage('create'); else window.location.hash = '#';
            } else if (hash === 'pricing') {
                 if(user) setPage('pricing'); else window.location.hash = '#';
            } else if (hash === 'my-decisions') {
                 if(user && !user.isAnonymous) setPage('my-decisions'); else window.location.hash = '#';
            } else {
                setPage('home');
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [user]);

    if (!isAuthReady || !user) {
        return <LoadingScreen message="Initializing Clarity..." />;
    }
    
    // --- Page Rendering ---
    const renderPage = () => {
        switch (page) {
            case 'create': return user && userStatus && !user.isAnonymous ? <CreateDecisionPage db={db} user={user} userStatus={userStatus} setUserStatus={setUserStatus} navigate={navigate} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            case 'decision': return <DecisionPage db={db} user={user} auth={auth} navigate={navigate} decisionId={decisionId} />;
            case 'pricing': return user && userStatus ? <PricingPage db={db} user={user} navigate={navigate} setUserStatus={setUserStatus} userStatus={userStatus} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            case 'my-decisions': return user && !user.isAnonymous ? <MyDecisionsPage db={db} user={user} navigate={navigate} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            default: return <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
        }
    };

    return (
        <div className="text-slate-200 font-sans">
            <Background />
            <div className="relative z-0 font-body">{renderPage()}</div>
        </div>
    );
}