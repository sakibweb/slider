(function () {
    'use strict';

    function Slider(options) {
        if (!(this instanceof Slider)) {
            throw new TypeError('Cannot call a class as a function');
        }

        this.config = Slider.mergeSettings(options);
        this.selector =
            typeof this.config.selector === 'string'
                ? document.querySelector(this.config.selector)
                : this.config.selector;

        if (this.selector === null) {
            throw new Error('Slider selector not found.');
        }

        this.resolveSlidesNumber();
        this.selectorWidth = this.selector.offsetWidth;
        this.innerElements = [].slice.call(this.selector.children);
        this.currentSlide = this.config.loop
            ? this.config.startIndex % this.innerElements.length
            : Math.max(
                0,
                Math.min(this.config.startIndex, this.innerElements.length - this.perPage)
            );
        this.transformProperty = Slider.webkitOrNot();
        this.intervalId = null;
        this.observer = null;
        this.navDots = [];

        const bindedMethods = [
            'resizeHandler',
            'touchstartHandler',
            'touchendHandler',
            'touchmoveHandler',
            'mousedownHandler',
            'mouseupHandler',
            'mouseleaveHandler',
            'mousemoveHandler',
            'clickHandler',
            'autoplay',
            'stopAutoplay',
            'startAutoplay',
            'checkViewport',
            'prevSlide',
            'nextSlide',
            'handleDotClick'
        ];
        bindedMethods.forEach((method) => {
            this[method] = this[method].bind(this);
        });

        this.init();
    }

    Slider.prototype = {
        attachEvents: function () {
            window.addEventListener('resize', this.resizeHandler);
            if (this.config.draggable) {
                this.pointerDown = false;
                this.drag = {
                    startX: 0,
                    endX: 0,
                    startY: 0,
                    letItGo: null,
                    preventClick: false,
                };
                this.selector.addEventListener('touchstart', this.touchstartHandler);
                this.selector.addEventListener('touchend', this.touchendHandler);
                this.selector.addEventListener('touchmove', this.touchmoveHandler);
                this.selector.addEventListener('mousedown', this.mousedownHandler);
                this.selector.addEventListener('mouseup', this.mouseupHandler);
                this.selector.addEventListener('mouseleave', this.mouseleaveHandler);
                this.selector.addEventListener('mousemove', this.mousemoveHandler);
                this.selector.addEventListener('click', this.clickHandler);
            }
        },

        detachEvents: function () {
            window.removeEventListener('resize', this.resizeHandler);
            this.selector.removeEventListener('touchstart', this.touchstartHandler);
            this.selector.removeEventListener('touchend', this.touchendHandler);
            this.selector.removeEventListener('touchmove', this.touchmoveHandler);
            this.selector.removeEventListener('mousedown', this.mousedownHandler);
            this.selector.removeEventListener('mouseup', this.mouseupHandler);
            this.selector.removeEventListener('mouseleave', this.mouseleaveHandler);
            this.selector.removeEventListener('mousemove', this.mousemoveHandler);
            this.selector.removeEventListener('click', this.clickHandler);
        },

        init: function () {
            this.attachEvents();
            this.selector.style.overflow = 'hidden';
            this.selector.style.direction = this.config.rtl ? 'rtl' : 'ltr';
            this.buildSliderFrame();
            this.config.onInit.call(this);

            if (this.config.autoplay && !this.config.viewportPlay) {
                this.startAutoplay();
            }

            if (this.config.viewportPlay) {
                this.checkViewport();
            }
        },

        buildSliderFrame: function () {
            const slideWidth = this.selectorWidth / this.perPage;
            const slidesToDisplay = this.config.loop
                ? this.innerElements.length + 2 * this.perPage
                : this.innerElements.length;
            this.sliderFrame = document.createElement('div');
            this.sliderFrame.style.width = slideWidth * slidesToDisplay + 'px';
            this.enableTransition();
            if (this.config.draggable) {
                this.selector.style.cursor = '-webkit-grab';
            }

            const fragment = document.createDocumentFragment();

            if (this.config.loop) {
                for (let i = this.innerElements.length - this.perPage; i < this.innerElements.length; i++) {
                    const clonedSlide = this.innerElements[i].cloneNode(true);
                    const frameItem = this.buildSliderFrameItem(clonedSlide);
                    fragment.appendChild(frameItem);
                }
            }

            for (let i = 0; i < this.innerElements.length; i++) {
                const frameItem = this.buildSliderFrameItem(this.innerElements[i]);
                fragment.appendChild(frameItem);
            }

            if (this.config.loop) {
                for (let i = 0; i < this.perPage; i++) {
                    const clonedSlide = this.innerElements[i].cloneNode(true);
                    const frameItem = this.buildSliderFrameItem(clonedSlide);
                    fragment.appendChild(frameItem);
                }
            }

            this.sliderFrame.appendChild(fragment);
            this.selector.innerHTML = '';
            this.selector.appendChild(this.sliderFrame);

            if (this.config.controls || this.config.nav) {
                this.buildSliderControls();
            }

            this.slideToCurrent();
        },

        buildSliderFrameItem: function (slide) {
            const frameItem = document.createElement('div');
            frameItem.style.cssFloat = this.config.rtl ? 'right' : 'left';
            frameItem.style.float = this.config.rtl ? 'right' : 'left';
            frameItem.style.width = (this.config.loop
                ? 100 / (this.innerElements.length + 2 * this.perPage)
                : 100 / this.innerElements.length) + '%';
            frameItem.appendChild(slide);
            return frameItem;
        },

        buildSliderControls: function () {
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'slider-controls';

            if (this.config.controls) {
                const prevButton = document.createElement('button');
                prevButton.className = 'slider-prev';
                prevButton.textContent = '<';
                prevButton.addEventListener('click', this.prevSlide);

                const nextButton = document.createElement('button');
                nextButton.className = 'slider-next';
                nextButton.textContent = '>';
                nextButton.addEventListener('click', this.nextSlide);

                controlsContainer.appendChild(prevButton);
                controlsContainer.appendChild(nextButton);
            }

            if (this.config.nav) {
                const navContainer = document.createElement('div');
                navContainer.className = 'slider-nav';
                for (let i = 0; i < this.innerElements.length; i++) {
                    const navItem = document.createElement('button');
                    navItem.className = 'slider-nav-item';
                    navItem.dataset.index = i;
                    navItem.addEventListener('click', this.handleDotClick);
                    navContainer.appendChild(navItem);
                    this.navDots.push(navItem);
                }
                controlsContainer.appendChild(navContainer);
            }

            this.selector.parentNode.insertBefore(controlsContainer, this.selector.nextSibling);
            Slider.injectSliderCSS();
            this.updateNavDots();
        },

        resolveSlidesNumber: function () {
            if (typeof this.config.perPage === 'number') {
                this.perPage = this.config.perPage;
            } else if (typeof this.config.perPage === 'object') {
                this.perPage = 1;
                for (const viewportWidth in this.config.perPage) {
                    if (window.innerWidth >= viewportWidth) {
                        this.perPage = this.config.perPage[viewportWidth];
                    }
                }
            }
        },

        prev: function (step = 1, callback) {
            if (this.innerElements.length <= this.perPage) return;

            let initialSlide = this.currentSlide;

            if (this.config.loop) {
                if (this.currentSlide - step < 0) {
                    this.disableTransition();
                    const preLoopSlidePosition = this.currentSlide + this.innerElements.length;
                    const perPage = this.perPage;
                    const slidesNumber = preLoopSlidePosition + perPage;
                    const translatePosition =
                        (this.config.rtl ? 1 : -1) * slidesNumber * (this.selectorWidth / this.perPage);
                    const dragOffset = this.config.draggable ? this.drag.endX - this.drag.startX : 0;

                    this.sliderFrame.style[this.transformProperty] =
                        'translate3d(' + (translatePosition + dragOffset) + 'px, 0, 0)';
                    this.currentSlide = preLoopSlidePosition - step;
                } else {
                    this.currentSlide = this.currentSlide - step;
                }
            } else {
                this.currentSlide = Math.max(this.currentSlide - step, 0);
            }

            if (initialSlide !== this.currentSlide) {
                this.slideToCurrent(this.config.loop);
                this.config.onChange.call(this);
                if (callback) callback.call(this);
            }
        },

        next: function (step = 1, callback) {
            if (this.innerElements.length <= this.perPage) return;

            let initialSlide = this.currentSlide;

            if (this.config.loop) {
                if (this.currentSlide + step > this.innerElements.length - this.perPage) {
                    this.disableTransition();
                    const preLoopSlidePosition = this.currentSlide - this.innerElements.length;
                    const perPage = this.perPage;
                    const slidesNumber = preLoopSlidePosition + perPage;
                    const translatePosition =
                        (this.config.rtl ? 1 : -1) * slidesNumber * (this.selectorWidth / this.perPage);
                    const dragOffset = this.config.draggable ? this.drag.endX - this.drag.startX : 0;

                    this.sliderFrame.style[this.transformProperty] =
                        'translate3d(' + (translatePosition + dragOffset) + 'px, 0, 0)';
                    this.currentSlide = preLoopSlidePosition + step;
                } else {
                    this.currentSlide = this.currentSlide + step;
                }
            } else {
                this.currentSlide = Math.min(
                    this.currentSlide + step,
                    this.innerElements.length - this.perPage
                );
            }

            if (initialSlide !== this.currentSlide) {
                this.slideToCurrent(this.config.loop);
                this.config.onChange.call(this);
                if (callback) callback.call(this);
            }
        },

        disableTransition: function () {
            this.sliderFrame.style.webkitTransition = 'all 0ms ' + this.config.easing;
            this.sliderFrame.style.transition = 'all 0ms ' + this.config.easing;
        },

        enableTransition: function () {
            this.sliderFrame.style.webkitTransition = 'all ' + this.config.duration + 'ms ' + this.config.easing;
            this.sliderFrame.style.transition = 'all ' + this.config.duration + 'ms ' + this.config.easing;
        },

        goTo: function (slideIndex, callback) {
            if (this.innerElements.length <= this.perPage) return;

            let initialSlide = this.currentSlide;
            this.currentSlide = this.config.loop
                ? slideIndex % this.innerElements.length
                : Math.min(Math.max(slideIndex, 0), this.innerElements.length - this.perPage);

            if (initialSlide !== this.currentSlide) {
                this.slideToCurrent();
                this.config.onChange.call(this);
                if (callback) callback.call(this);
            }
        },

        slideToCurrent: function (isLooping) {
            const translatePosition = this.config.loop
                ? this.currentSlide + this.perPage
                : this.currentSlide;
            const moveTo = (this.config.rtl ? 1 : -1) * translatePosition * (this.selectorWidth / this.perPage);

            if (isLooping) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.enableTransition();
                        this.sliderFrame.style[this.transformProperty] =
                            'translate3d(' + moveTo + 'px, 0, 0)';
                        this.updateNavDots();
                    });
                });
            } else {
                this.sliderFrame.style[this.transformProperty] = 'translate3d(' + moveTo + 'px, 0, 0)';
                this.updateNavDots();
            }
        },

        updateNavDots: function () {
            if (this.config.nav && this.navDots.length > 0) {
                this.navDots.forEach(dot => dot.classList.remove('active'));
                this.navDots[this.currentSlide % this.innerElements.length].classList.add('active');
            }
        },

        updateAfterDrag: function () {
            const movement = (this.config.rtl ? -1 : 1) * (this.drag.endX - this.drag.startX);
            const movementDistance = Math.abs(movement);
            const step = this.config.multipleDrag
                ? Math.ceil(movementDistance / (this.selectorWidth / this.perPage))
                : 1;
            const isSwipingForward = movement > 0 && this.currentSlide - step < 0;
            const isSwipingBackward =
                movement < 0 && this.currentSlide + step > this.innerElements.length - this.perPage;

            if (movement > 0 && movementDistance > this.config.threshold && this.innerElements.length > this.perPage) {
                this.prev(step);
            } else if (
                movement < 0 &&
                movementDistance > this.config.threshold &&
                this.innerElements.length > this.perPage
            ) {
                this.next(step);
            }

            this.slideToCurrent(isSwipingForward || isSwipingBackward);
        },

        resizeHandler: function () {
            this.resolveSlidesNumber();
            if (this.currentSlide + this.perPage > this.innerElements.length) {
                this.currentSlide =
                    this.innerElements.length <= this.perPage
                        ? 0
                        : this.innerElements.length - this.perPage;
            }
            this.selectorWidth = this.selector.offsetWidth;
            this.buildSliderFrame();
        },

        clearDrag: function () {
            this.drag = { startX: 0, endX: 0, startY: 0, letItGo: null, preventClick: this.drag.preventClick };
        },

        touchstartHandler: function (e) {
            if (['TEXTAREA', 'OPTION', 'INPUT', 'SELECT'].indexOf(e.target.nodeName) !== -1) return;
            e.stopPropagation();
            this.pointerDown = true;
            this.drag.startX = e.touches[0].pageX;
            this.drag.startY = e.touches[0].pageY;
            if (!this.config.viewportPlay) this.stopAutoplay();
        },

        touchendHandler: function (e) {
            e.stopPropagation();
            this.pointerDown = false;
            this.enableTransition();
            if (this.drag.endX) {
                this.updateAfterDrag();
            }
            this.clearDrag();
            if (!this.config.viewportPlay) this.startAutoplay();
        },

        touchmoveHandler: function (e) {
            e.stopPropagation();
            if (this.drag.letItGo === null) {
                this.drag.letItGo =
                    Math.abs(this.drag.startY - e.touches[0].pageY) <
                    Math.abs(this.drag.startX - e.touches[0].pageX);
            }

            if (this.pointerDown && this.drag.letItGo) {
                e.preventDefault();
                this.drag.endX = e.touches[0].pageX;
                this.sliderFrame.style.webkitTransition = 'all 0ms ' + this.config.easing;
                this.sliderFrame.style.transition = 'all 0ms ' + this.config.easing;

                const translatePosition = this.config.loop
                    ? this.currentSlide + this.perPage
                    : this.currentSlide;
                const initialPosition = translatePosition * (this.selectorWidth / this.perPage);
                const dragOffset = this.drag.endX - this.drag.startX;
                const moveTo = this.config.rtl ? initialPosition + dragOffset : initialPosition - dragOffset;

                this.sliderFrame.style[this.transformProperty] =
                    'translate3d(' + (this.config.rtl ? 1 : -1) * moveTo + 'px, 0, 0)';
            }
        },

        mousedownHandler: function (e) {
            if (['TEXTAREA', 'OPTION', 'INPUT', 'SELECT'].indexOf(e.target.nodeName) !== -1) return;
            e.preventDefault();
            e.stopPropagation();
            this.pointerDown = true;
            this.drag.startX = e.pageX;
            if (!this.config.viewportPlay) this.stopAutoplay();
        },

        mouseupHandler: function (e) {
            e.stopPropagation();
            this.pointerDown = false;
            this.selector.style.cursor = '-webkit-grab';
            this.enableTransition();
            if (this.drag.endX) {
                this.updateAfterDrag();
            }
            this.clearDrag();
            if (!this.config.viewportPlay) this.startAutoplay();
        },

        mousemoveHandler: function (e) {
            e.preventDefault();
            if (this.pointerDown) {
                if (e.target.nodeName === 'A') {
                    this.drag.preventClick = true;
                }
                this.drag.endX = e.pageX;
                this.selector.style.cursor = '-webkit-grabbing';
                this.sliderFrame.style.webkitTransition = 'all 0ms ' + this.config.easing;
                this.sliderFrame.style.transition = 'all 0ms ' + this.config.easing;

                const translatePosition = this.config.loop
                    ? this.currentSlide + this.perPage
                    : this.currentSlide;
                const initialPosition = translatePosition * (this.selectorWidth / this.perPage);
                const dragOffset = this.drag.endX - this.drag.startX;
                const moveTo = this.config.rtl ? initialPosition + dragOffset : initialPosition - dragOffset;

                this.sliderFrame.style[this.transformProperty] =
                    'translate3d(' + (this.config.rtl ? 1 : -1) * moveTo + 'px, 0, 0)';
            }
        },

        mouseleaveHandler: function (e) {
            if (this.pointerDown) {
                this.pointerDown = false;
                this.selector.style.cursor = '-webkit-grab';
                this.drag.endX = e.pageX;
                this.drag.preventClick = false;
                this.enableTransition();
                this.updateAfterDrag();
                this.clearDrag();
                if (!this.config.viewportPlay) this.startAutoplay();
            }
        },

        clickHandler: function (e) {
            if (this.drag.preventClick) {
                e.preventDefault();
            }
            this.drag.preventClick = false;
        },

        remove: function (index, callback) {
            if (index < 0 || index >= this.innerElements.length) {
                throw new Error("Slider item to remove does not exist.");
            }

            const isRemovingVisibleSlide = index < this.currentSlide;
            const isRemovingLastVisibleSlide = this.currentSlide + this.perPage - 1 === index;

            if (isRemovingVisibleSlide || isRemovingLastVisibleSlide) {
                this.currentSlide--;
            }

            this.innerElements.splice(index, 1);
            this.buildSliderFrame();
            if (callback) callback.call(this);
        },

        insert: function (item, index, callback) {
            if (index < 0 || index > this.innerElements.length + 1) {
                throw new Error('Cannot insert slider item at this index.');
            }
            if (this.innerElements.indexOf(item) !== -1) {
                throw new Error('Cannot insert duplicate item into slider.');
            }

            const isInsertingBeforeVisibleSlides = index <= this.currentSlide > 0 && this.innerElements.length;
            if (isInsertingBeforeVisibleSlides) {
                this.currentSlide++;
            }

            this.innerElements.splice(index, 0, item);
            this.buildSliderFrame();
            if (callback) callback.call(this);
        },

        prepend: function (item, callback) {
            this.insert(item, 0);
            if (callback) callback.call(this);
        },

        append: function (item, callback) {
            this.insert(item, this.innerElements.length + 1);
            if (callback) callback.call(this);
        },

        destroy: function (destroyMarkup = false, callback) {
            this.detachEvents();
            this.selector.style.cursor = 'auto';
            this.stopAutoplay();
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.config.controls) {
                const controls = this.selector.nextElementSibling;
                if (controls && controls.classList.contains('slider-controls')) {
                    controls.remove();
                }
            }

            if (destroyMarkup) {
                const fragment = document.createDocumentFragment();
                for (let i = 0; i < this.innerElements.length; i++) {
                    fragment.appendChild(this.innerElements[i]);
                }
                this.selector.innerHTML = '';
                this.selector.appendChild(fragment);
                this.selector.removeAttribute('style');
            }
            if (callback) callback.call(this);
        },

        autoplay: function () {
            if (this.config.autoplay) {
                this.intervalId = setInterval(() => {
                    this.next();
                }, this.config.interval);
            }
        },

        startAutoplay: function () {
            if ((this.config.autoplay || this.config.viewportPlay) && !this.intervalId) {
                this.autoplay();
            }
        },

        stopAutoplay: function () {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },

        checkViewport: function () {
            if (!('IntersectionObserver' in window)) {
                console.warn('IntersectionObserver is not supported, viewportPlay will not function.');
                return;
            }

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.startAutoplay();
                    } else {
                        this.stopAutoplay();
                    }
                });
            }, {
                threshold: [0, 0.25, 0.5, 0.75, 1]
            });

            this.observer.observe(this.selector);
        },

        prevSlide: function() {
            this.prev();
        },

        nextSlide: function() {
            this.next();
        },

        handleDotClick: function(event) {
            const index = parseInt(event.target.dataset.index, 10);
            this.goTo(index);
        }


    };

    Slider.mergeSettings = function (settings) {
        const defaultSettings = {
            selector: '.slider',
            duration: 200,
            easing: 'ease-out',
            perPage: 1,
            startIndex: 0,
            draggable: true,
            multipleDrag: true,
            threshold: 20,
            loop: false,
            rtl: false,
            autoplay: false,
            interval: 3000,
            viewportPlay: false,
            controls: false,
            nav: false,
            onInit: function () { },
            onChange: function () { },
        };
        const config = settings || {};
        for (const setting in config) {
            defaultSettings[setting] = config[setting];
        }
        return defaultSettings;
    };

    Slider.webkitOrNot = function () {
        return typeof document.documentElement.style.transform !== 'undefined'
            ? 'transform'
            : 'WebkitTransform';
    };

    Slider.injectSliderCSS = function() {
        if (document.querySelector('#slider-style')) return;

        const style = document.createElement('style');
        style.id = 'slider-style';
        style.textContent = `
            .slider-controls {
                display: flex;
                justify-content: center;
                margin-top: 10px;
            }

            .slider-prev, .slider-next {
                background: none;
                border: 1px solid #ccc;
                font-size: 1em;
                cursor: pointer;
                padding: 5px 10px;
                margin: 0 5px;
                opacity: 0.7;
                transition: opacity 0.3s ease;
                border-radius: 5px;
            }

            .slider-prev:hover, .slider-next:hover {
                opacity: 1;
            }

            .slider-nav {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .slider-nav-item {
                background-color: #bbb;
                border: none;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin: 0 3px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.3s ease, background-color 0.3s ease;
            }

            .slider-nav-item:hover, .slider-nav-item.active {
                opacity: 1;
            }

            .slider-nav-item.active {
                background-color: #333;
            }
        `;
        document.head.appendChild(style);
    };


    document.addEventListener('DOMContentLoaded', function () {
        const sliderElements = document.querySelectorAll('.slider');
        sliderElements.forEach(function (element) {
            const options = {};
            if (element.hasAttribute('duration')) {
                options.duration = parseInt(element.getAttribute('duration'), 10);
            }
            if (element.hasAttribute('draggable')) {
                options.draggable = element.getAttribute('draggable') === 'true';
            }
            if (element.hasAttribute('loop')) {
                options.loop = element.getAttribute('loop') === 'true';
            }
            if (element.hasAttribute('autoplay')) {
                options.autoplay = element.getAttribute('autoplay') === 'true';
            }
            if (element.hasAttribute('interval')) {
                options.interval = parseInt(element.getAttribute('interval'), 10);
            }
            if (element.hasAttribute('viewport')) {
                options.viewportPlay = element.getAttribute('viewport') === 'true';
            }
            if (element.hasAttribute('controls')) {
                options.controls = element.getAttribute('controls') === 'true';
            }
            if (element.hasAttribute('nav')) {
                options.nav = element.getAttribute('nav') === 'true';
            }


            new Slider({ selector: element, ...options });
        });
    });


    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Slider;
    } else if (typeof define === 'function' && define.amd) {
        define('Slider', [], function () {
            return Slider;
        });
    } else {
        window.Slider = Slider;
    }
})();
