# Integrals

Indefinite integrals (add $+\,C$), then the main techniques.

Q: $\displaystyle\int x^n\,dx$
A: $$\int x^n\,dx = \frac{x^{n+1}}{n+1} + C$$

For $n \neq -1$.

Q: $\displaystyle\int \frac{1}{x}\,dx$
A: $$\int \frac{1}{x}\,dx = \ln|x| + C$$

Q: $\displaystyle\int e^x\,dx$
A: $$\int e^x\,dx = e^x + C$$

Q: $\displaystyle\int e^{ax}\,dx$
A: $$\int e^{ax}\,dx = \frac{1}{a}\,e^{ax} + C$$

For $a \neq 0$.

Q: $\displaystyle\int a^x\,dx$
A: $$\int a^x\,dx = \frac{a^x}{\ln a} + C$$

Q: $\displaystyle\int \ln x\,dx$
A: $$\int \ln x\,dx = x\ln x - x + C$$

Integrate by parts with $u = \ln x$, $dv = dx$.

Q: $\displaystyle\int \sin x\,dx$
A: $$\int \sin x\,dx = -\cos x + C$$

Q: $\displaystyle\int \cos x\,dx$
A: $$\int \cos x\,dx = \sin x + C$$

Q: $\displaystyle\int \frac{1}{\cos^2 x}\,dx$
A: $$\int \frac{1}{\cos^2 x}\,dx = \tan x + C$$

Same as $\int \sec^2 x\,dx$.

Q: $\displaystyle\int \frac{1}{\sin^2 x}\,dx$
A: $$\int \frac{1}{\sin^2 x}\,dx = -\cot x + C$$

Same as $\int \csc^2 x\,dx$.

Q: $\displaystyle\int \tan x\,dx$
A: $$\int \tan x\,dx = -\ln|\cos x| + C$$

Q: $\displaystyle\int \cot x\,dx$
A: $$\int \cot x\,dx = \ln|\sin x| + C$$

Q: $\displaystyle\int \sec x\,dx$
A: $$\int \sec x\,dx = \ln|\sec x + \tan x| + C$$

Q: $\displaystyle\int \sin^2 x\,dx$
A: $$\int \sin^2 x\,dx = \frac{x}{2} - \frac{\sin 2x}{4} + C$$

Use $\sin^2 x = \dfrac{1 - \cos 2x}{2}$.

Q: $\displaystyle\int \cos^2 x\,dx$
A: $$\int \cos^2 x\,dx = \frac{x}{2} + \frac{\sin 2x}{4} + C$$

Use $\cos^2 x = \dfrac{1 + \cos 2x}{2}$.

Q: $\displaystyle\int \frac{1}{\sqrt{1 - x^2}}\,dx$
A: $$\int \frac{1}{\sqrt{1 - x^2}}\,dx = \arcsin x + C$$

Q: $\displaystyle\int \frac{1}{1 + x^2}\,dx$
A: $$\int \frac{1}{1 + x^2}\,dx = \arctan x + C$$

Q: $\displaystyle\int \frac{1}{\sqrt{a^2 - x^2}}\,dx$
A: $$\int \frac{1}{\sqrt{a^2 - x^2}}\,dx = \arcsin\frac{x}{a} + C$$

For $a > 0$.

Q: $\displaystyle\int \frac{1}{a^2 + x^2}\,dx$
A: $$\int \frac{1}{a^2 + x^2}\,dx = \frac{1}{a}\arctan\frac{x}{a} + C$$

Q: $\displaystyle\int \frac{1}{x^2 - a^2}\,dx$
A: $$\int \frac{1}{x^2 - a^2}\,dx = \frac{1}{2a}\ln\left|\frac{x - a}{x + a}\right| + C$$

Q: $\displaystyle\int \frac{1}{\sqrt{x^2 \pm a^2}}\,dx$
A: $$\int \frac{1}{\sqrt{x^2 \pm a^2}}\,dx = \ln\left|x + \sqrt{x^2 \pm a^2}\right| + C$$

Q: $\displaystyle\int \sqrt{a^2 - x^2}\,dx$
A: $$\begin{aligned} \int \sqrt{a^2 - x^2}\,dx &= \frac{x}{2}\sqrt{a^2 - x^2} \\ &\quad + \frac{a^2}{2}\arcsin\frac{x}{a} + C \end{aligned}$$

Q: $\displaystyle\int \frac{f'(x)}{f(x)}\,dx$
A: $$\int \frac{f'(x)}{f(x)}\,dx = \ln|f(x)| + C$$

Q: Integration by parts
A: $$\int u\,dv = uv - \int v\,du$$

Q: Substitution rule
A: $$\int f(g(x))\,g'(x)\,dx = \int f(u)\,du$$

With $u = g(x)$, so $du = g'(x)\,dx$.

Q: Fundamental theorem of calculus
A: $$\int_a^b f(x)\,dx = F(b) - F(a)$$

Where $F$ is any antiderivative of $f$ ($F' = f$).
