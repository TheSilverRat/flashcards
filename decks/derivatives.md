# Derivatives

Basic rules, then exponentials/logs, trig, inverse trig and a few useful extras.

Q: Definition of the derivative
A: $$f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}$$

Q: $\dfrac{d}{dx}\,c$ (constant)
A: $$\frac{d}{dx}\,c = 0$$

Q: Power rule: $\dfrac{d}{dx}\,x^n$
A: $$\frac{d}{dx}\,x^n = n\,x^{n-1}$$

Q: Constant multiple rule: $(c \cdot f)'$
A: $$(c \cdot f)' = c \cdot f'$$

Q: Sum rule: $(f \pm g)'$
A: $$(f \pm g)' = f' \pm g'$$

Q: Product rule: $(f \cdot g)'$
A: $$(f \cdot g)' = f'g + fg'$$

Q: Quotient rule: $\left(\dfrac{f}{g}\right)'$
A: $$\left(\frac{f}{g}\right)' = \frac{f'g - fg'}{g^2}$$

Q: Chain rule: $\dfrac{d}{dx}\,f(g(x))$
A: $$\frac{d}{dx}\,f(g(x)) = f'(g(x)) \cdot g'(x)$$

Q: Derivative of an inverse function: $\left(f^{-1}\right)'(y)$
A: $$\left(f^{-1}\right)'(y) = \frac{1}{f'(x)}, \quad y = f(x)$$

Q: $\dfrac{d}{dx}\,e^x$
A: $$\frac{d}{dx}\,e^x = e^x$$

Q: $\dfrac{d}{dx}\,a^x$
A: $$\frac{d}{dx}\,a^x = a^x \ln a$$

Q: $\dfrac{d}{dx}\,\ln x$
A: $$\frac{d}{dx}\,\ln x = \frac{1}{x}$$

More generally $\dfrac{d}{dx}\ln|x| = \dfrac{1}{x}$ for $x \neq 0$.

Q: $\dfrac{d}{dx}\,\log_a x$
A: $$\frac{d}{dx}\,\log_a x = \frac{1}{x \ln a}$$

Q: $\dfrac{d}{dx}\,\sqrt{x}$
A: $$\frac{d}{dx}\,\sqrt{x} = \frac{1}{2\sqrt{x}}$$

Q: $\dfrac{d}{dx}\,\dfrac{1}{x}$
A: $$\frac{d}{dx}\,\frac{1}{x} = -\frac{1}{x^2}$$

Q: $\dfrac{d}{dx}\,\sin x$
A: $$\frac{d}{dx}\,\sin x = \cos x$$

Q: $\dfrac{d}{dx}\,\cos x$
A: $$\frac{d}{dx}\,\cos x = -\sin x$$

Q: $\dfrac{d}{dx}\,\tan x$
A: $$\frac{d}{dx}\,\tan x = \frac{1}{\cos^2 x} = \sec^2 x$$

Also equal to $1 + \tan^2 x$.

Q: $\dfrac{d}{dx}\,\cot x$
A: $$\frac{d}{dx}\,\cot x = -\frac{1}{\sin^2 x} = -\csc^2 x$$

Q: $\dfrac{d}{dx}\,\sec x$
A: $$\frac{d}{dx}\,\sec x = \sec x \tan x$$

Q: $\dfrac{d}{dx}\,\csc x$
A: $$\frac{d}{dx}\,\csc x = -\csc x \cot x$$

Q: $\dfrac{d}{dx}\,\arcsin x$
A: $$\frac{d}{dx}\,\arcsin x = \frac{1}{\sqrt{1 - x^2}}$$

Q: $\dfrac{d}{dx}\,\arccos x$
A: $$\frac{d}{dx}\,\arccos x = -\frac{1}{\sqrt{1 - x^2}}$$

Q: $\dfrac{d}{dx}\,\arctan x$
A: $$\frac{d}{dx}\,\arctan x = \frac{1}{1 + x^2}$$

Q: $\dfrac{d}{dx}\,\operatorname{arccot} x$
A: $$\frac{d}{dx}\,\operatorname{arccot} x = -\frac{1}{1 + x^2}$$

Q: $\dfrac{d}{dx}\,\sinh x$
A: $$\frac{d}{dx}\,\sinh x = \cosh x$$

Q: $\dfrac{d}{dx}\,\cosh x$
A: $$\frac{d}{dx}\,\cosh x = \sinh x$$

Q: $\dfrac{d}{dx}\,x^x$
A: $$\frac{d}{dx}\,x^x = x^x(\ln x + 1)$$

Write $x^x = e^{x \ln x}$, then use the chain and product rules.
