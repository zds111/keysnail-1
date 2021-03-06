let ksPluginManager = (function () {
    var modules;

    var parserContext;

    // ==== holder ==== //

    var pluginInfoHolder;
    var xulHolder;

    // ==== iframe dom objects ==== //

    var iframeDoc;
    var container;
    var helpBox;
    var infoBox;
    var detailBox;

    // ==== XUL DOM objects ==== //

    var pluginDescriptionFrame;
    var pluginListbox;

    // ==== other values ==== //

    const KS_PLUGIN_DISABLED      = "disabled";
    const KS_PLUGIN_ENABLED       = "enabled";
    const KS_PLUGIN_NOTCOMPATIBLE = "not-compatible";

    function $E(name, attrs, childs) {
        let elem = document.createElement(name);

        if (attrs)
            for (let [k, v] in Iterator(attrs))
                elem.setAttribute(k, v);

        if (childs)
            for (let [, child] in Iterator(childs))
                elem.appendChild(child);

        return elem;
    }

    function createElementWithText(aElemName, aText) {
        var elem = iframeDoc.createElement(aElemName);
        elem.appendChild(iframeDoc.createTextNode(aText));

        return elem;
    }

    function removeAllChilds(aElement) {
        while (aElement.hasChildNodes()) {
            aElement.removeChild(aElement.firstChild);
        }
    }

    function initPluginList() {
        removeAllChilds(pluginListbox);

        pluginInfoHolder = {};
        xulHolder = {};

        for (let pluginPath in modules.plugins.context)
        {
            let pluginContext   = modules.plugins.context[pluginPath];
            let isDisabled      = modules.userscript.isDisabledPlugin(pluginPath);
            let isNotCompatible = pluginContext.__ksNotCompatible__;

            if (!pluginContext.__ksLoaded__)
            {
                // for not loaded plugin
                // open script and read its PLUGIN_INFO value

                try
                {
                    let pluginText = modules.util.readTextFile(pluginPath);
                    pluginContext.__ksPluginInfo__ = modules.userscript.getPluginInformation(pluginText);
                }
                catch (x)
                {
                    modules.util.message("initPluginList : " + x);
                    continue;
                }
            }

            let pluginInfo = pluginInfoHolder[pluginPath] = pluginContext.__ksPluginInfo__;

            // set name
            let pluginName = pluginInfo.name;
            if (!pluginName)
            {
                pluginName = pluginContext.__ksFileName__;
                pluginInfo.name = pluginName;
            }

            // ======================================== //

            xulHolder[pluginPath] = {};

            let item = document.createElement("richlistitem");
            item.setAttribute("class", "plugin-listitem");
            xulHolder[pluginPath].item = item;

            let pluginWhole = document.createElement("vbox");
            pluginWhole.flex = 1;

            let buttonsContainer = document.createElement("hbox");
            buttonsContainer.flex = 1;

            let pluginHeader = document.createElement("hbox");
            pluginHeader.setAttribute("align", "center");
            pluginHeader.setAttribute("id", "center");

            let imageContainer = document.createElement("vbox");
            imageContainer.setAttribute("align", "center");

            let image = document.createElement("image");
            image.setAttribute("class", "plugin-icon");
            image.setAttribute("src", pluginInfo.iconURL);
            imageContainer.appendChild(image);

            let description;
            let pluginNameContainer = document.createElement("hbox");

            description = document.createElement("description");
            description.setAttribute("value", pluginName);
            description.setAttribute("class", "plugin-name");
            pluginNameContainer.appendChild(description);

            description = document.createElement("description");
            description.setAttribute("value", pluginInfo.version);
            description.setAttribute("class", "plugin-version");
            pluginNameContainer.appendChild(description);

            let infoContainer = document.createElement("vbox");
            infoContainer.appendChild(pluginNameContainer);

            // plugin description
            description = document.createElement("description");
            description.setAttribute("value", pluginInfo.description);
            infoContainer.appendChild(description);

            // notification (for not compatible plugin)
            description = document.createElement("description");
            description.setAttribute("class", "not-compatible-notification");
            infoContainer.appendChild(description);
            xulHolder[pluginPath].notification = description;

            pluginHeader.appendChild(imageContainer);
            pluginHeader.appendChild(infoContainer);

            let button;

            button = document.createElement("button");
            button.setAttribute("label", modules.util.getLocaleString("checkForUpdates"));
            button.setAttribute("class", "check-updates-button");
            button.setAttribute("accesskey", "c");
            button.onclick = checkForUpdatesButtonClicked;
            buttonsContainer.appendChild(button);
            xulHolder[pluginPath].checkForUpdatesButton = button;

            let spacer = document.createElement("spacer");
            spacer.flex = 1;
            buttonsContainer.appendChild(spacer);

            button = document.createElement("button");
            button.setAttribute("label", modules.util.getLocaleString("enable"));
            button.setAttribute("class", "enable-button");
            button.setAttribute("accesskey", "e");
            button.onclick = enableButtonClicked;
            buttonsContainer.appendChild(button);
            xulHolder[pluginPath].enableButton = button;

            button = document.createElement("button");
            button.setAttribute("label", modules.util.getLocaleString("disable"));
            button.setAttribute("class", "disable-button");
            button.setAttribute("accesskey", "d");
            button.onclick = disableButtonClicked;
            buttonsContainer.appendChild(button);
            xulHolder[pluginPath].disableButton = button;

            button = document.createElement("button");
            button.setAttribute("label", modules.util.getLocaleString("delete"));
            button.setAttribute("class", "delete-button");
            button.setAttribute("accesskey", "u");
            button.onclick = deleteButtonClicked;
            buttonsContainer.appendChild(button);

            pluginWhole.appendChild(pluginHeader);
            pluginWhole.appendChild(buttonsContainer);

            item.appendChild(pluginWhole);

            xulHolder[pluginPath].imageContainer   = imageContainer;
            xulHolder[pluginPath].infoContainer    = infoContainer;
            xulHolder[pluginPath].buttonsContainer = buttonsContainer;
            xulHolder[pluginPath].pluginHeader     = pluginHeader;

            // ======================================== //

            // key value
            item.value = pluginPath;

            let status =
                isNotCompatible ? KS_PLUGIN_NOTCOMPATIBLE :
                isDisabled      ? KS_PLUGIN_DISABLED : KS_PLUGIN_ENABLED;

            setPluginStatus(pluginPath, status);

            pluginListbox.appendChild(item);
        }
    }

    function setPluginStatus(aPluginPath, aStatus) {
        pluginInfoHolder[aPluginPath].status = aStatus;
        let pluginElementContainer = xulHolder[aPluginPath].item;
        pluginElementContainer.setAttribute("data-plugin-status", aStatus);
    }

    function updateInfoBox(aPluginPath) {
        const pluginInfo = pluginInfoHolder[aPluginPath];

        let title = pluginInfo.name +
            (pluginInfo.version ? " " + pluginInfo.version : "");
        let h2 = createElementWithText("h2", title);

        let description = createElementWithText("p", pluginInfo.description || "");

        // ====================================================================== //

        let h3 = createElementWithText("h3", modules.util.getLocaleString("info"));

        // FIXME: E4X
        let authorCell = <></>;
        let authorInfo = pluginInfo.authorInfo;
        if (authorInfo)
        {
            if (authorInfo.mailAddress)
                authorCell = <a href={'mailto:' + authorInfo.mailAddress}>{authorInfo.name}</a>;
            else
                authorCell = <>{authorInfo.name}</>;

            if (authorInfo.homepageURL)
                authorCell += <> [ <a href={authorInfo.homepageURL} target="_blank">Home page</a> ]</>;
        }

        // license
        let licenseCell = <></>;
        let licenseInfo = pluginInfo.licenseInfo;
        if (licenseInfo)
        {
            if (licenseInfo.documentationURL)
                licenseCell = <a href={licenseInfo.documentationURL} target="_blank">{licenseInfo.name}</a>;
            else
                licenseCell = <>{licenseInfo.name}</>;
        }

        // compatible version

        let versionMsg = "";
        let (minVersion = pluginInfo.minKeySnailVersion,
             maxVersion = pluginInfo.maxKeySnailVersion)
        {
            if (minVersion)
                versionMsg += modules.util.getLocaleString("compatibleMinVersion", [minVersion]);
            if (maxVersion)
                versionMsg += (minVersion ? " " : "") + modules.util.getLocaleString("compatibleMinVersion", [maxVersion]);
        };
        if (!versionMsg) versionMsg = "Not specified";

        // ====================================================================== //

        // FIXME: E4X
        let table = modules.util.xmlToDom(<table>
                                              <tr>
                                                  <td>{modules.util.getLocaleString("author")}</td>
                                                  <td>{authorCell}</td>
                                              </tr>
                                              <tr>
                                                  <td>{modules.util.getLocaleString("license")}</td>
                                                  <td>{licenseCell}</td>
                                              </tr>
                                              <tr>
                                                  <td>{modules.util.getLocaleString("compatibleVersion")}</td>
                                                  <td>{versionMsg}</td>
                                              </tr>
                                          </table> + "", modules.util.XHTML);

        // ====================================================================== //

        // now append elements to infoBox
        removeAllChilds(infoBox);

        infoBox.appendChild(h2);
        infoBox.appendChild(description);

        infoBox.appendChild(h3);
        infoBox.appendChild(table);

        // ============================== ext / option ============================== //

        let tr, th, td;

        // ext
        if (pluginInfo.exts && pluginInfo.exts.length)
        {
            h3 = createElementWithText("h3", modules.util.getLocaleString("ext"));
            table = iframeDoc.createElement("table");

            tr = iframeDoc.createElement("tr");
            tr.appendChild(createElementWithText("th", modules.util.getLocaleString("name")));
            tr.appendChild(createElementWithText("th", modules.util.getLocaleString("description")));
            table.appendChild(tr);

            pluginInfo.exts.forEach(function (extName) {
                let extDescription = modules.ext.description(extName);

                tr = iframeDoc.createElement("tr");
                tr.appendChild(createElementWithText("td", extName));
                tr.appendChild(createElementWithText("td", extDescription));

                table.appendChild(tr);
            });

            infoBox.appendChild(h3);
            infoBox.appendChild(table);
        }

        // option
        if (pluginInfo.options && pluginInfo.options.length)
        {
            h3 = createElementWithText("h3", modules.util.getLocaleString("option"));
            table = iframeDoc.createElement("table");

            tr = iframeDoc.createElement("tr");
            tr.appendChild(createElementWithText("th", modules.util.getLocaleString("name")));
            tr.appendChild(createElementWithText("th", modules.util.getLocaleString("type")));
            tr.appendChild(createElementWithText("th", modules.util.getLocaleString("description")));
            table.appendChild(tr);

            let hasOptionsWithNoDescription = false;

            pluginInfo.options.forEach(function (option) {
                tr = iframeDoc.createElement("tr");
                tr.appendChild(createElementWithText("td", option.name));
                tr.appendChild(createElementWithText("td", option.type));
                tr.appendChild(createElementWithText("td", option.description));

                if (!option.description) {
                    hasOptionsWithNoDescription = true;
                    tr.setAttribute("data-no-description", "hide");
                }

                table.appendChild(tr);
            });

            infoBox.appendChild(h3);

            if (hasOptionsWithNoDescription) {
                let buttonContainer = iframeDoc.createElement("div");
                buttonContainer.setAttribute("class", "centerize");

                let toggler = createElementWithText("span", modules.util.getLocaleString("toggleOptionsWithNoDescription"));
                toggler.setAttribute("class", "button");
                toggler.setAttribute("onclick", "pluginManagerContent.toggleOptions(event);");

                buttonContainer.appendChild(toggler);
                infoBox.appendChild(buttonContainer);
            }

            infoBox.appendChild(table);
        }
    }

    function prettifyAll() {
        let ev = document.createEvent("CommandEvent");
        ev.initCommandEvent("PrettifyAll", true, false, "pre[data-lang=javascript]");
        iframeDoc.dispatchEvent(ev);
    }

    function updateDetailBox(aPluginPath) {
        const pluginInfo = pluginInfoHolder[aPluginPath];

        if (pluginInfo.helpDocumentation)
        {
            var documentationHTML;

            if (pluginInfo.documentationHTMLCache)
                documentationHTML = pluginInfo.documentationHTMLCache;
            else
            {
                var parser = new parserContext.WikiParser(pluginInfo.helpDocumentation);
                documentationHTML = parser.parse();
                pluginInfo.documentationHTMLCache = documentationHTML;
            }

            detailBox.innerHTML = documentationHTML;
        }
        else
            detailBox.innerHTML = "<p>Not documented.</p>";

        prettifyAll();
    }

    function updateDisabledPluginList() {
        var disabledPlugins = [];

        for (let [pluginPath, ] in Iterator(pluginInfoHolder)) {
            if (pluginInfoHolder[pluginPath].status === KS_PLUGIN_DISABLED) {
                disabledPlugins.push(pluginPath);
            }
        }

        modules.util.setUnicharPref("extensions.keysnail.plugin.disabled_plugins",
                                    disabledPlugins.join(","));
    }

    function checkForUpdatesButtonClicked(aEvent) {
        if (aEvent.button !== 0)
            return;

        var item = pluginListbox.selectedItem;
        if (!item)
            return;

        let { util, userscript, display } = modules;

        var pluginPath = item.value;

        let button = aEvent.target;

        button.disabled = true;
        userscript.updatePlugin(pluginPath, function (updated) {
            button.disabled = false;

            if (updated) {
                initPluginList();
                updateInfoBox(pluginPath);
                updateDetailBox(pluginPath);

                let pluginInfo = pluginInfoHolder[pluginPath];

                display.notify(util.getLocaleString("pluginUpdated", [
                    pluginInfo.name,
                    pluginInfo.version
                ]));
            }
        });
    }

    function disableButtonClicked(aEvent) {
        if (aEvent.button !== 0)
            return;

        var item = pluginListbox.selectedItem;
        if (!item)
            return;

        var pluginPath = item.value;
        var pluginInfo = pluginInfoHolder[pluginPath];

        setPluginStatus(pluginPath, KS_PLUGIN_DISABLED);
        updateDisabledPluginList();

        modules.display.echoStatusBar(pluginInfo.name + " disabled", 2000);
    }

    function enableButtonClicked(aEvent) {
        if (aEvent.button !== 0)
            return;

        var item = pluginListbox.selectedItem;
        if (!item)
            return;

        var pluginPath = item.value;
        var pluginInfo = pluginInfoHolder[pluginPath];

        if (pluginInfo.status === KS_PLUGIN_NOTCOMPATIBLE)
            return;

        setPluginStatus(pluginPath, KS_PLUGIN_ENABLED);

        if (modules.plugins.context[pluginPath].__ksLoaded__) {
            modules.display.echoStatusBar(pluginInfo.name + " enabled", 2000);
        } else {
            // plugin is not loaded

            // to prevent this plugin considered as the "disabled"
            updateDisabledPluginList();

            // load plugin now
            modules.userscript.loadPlugin(modules.util.openFile(pluginPath));

            if (!modules.plugins.context[pluginPath].__ksLoaded__) {
                // failed to load plugin
                setPluginStatus(pluginPath, modules.plugins.context[pluginPath].__ksNotCompatible__ ?
                                KS_PLUGIN_NOTCOMPATIBLE : KS_PLUGIN_DISABLED);

                var msg = modules.util.getLocaleString("failedToLoadPlugin");
                modules.util.alert(msg, msg + ' "' + pluginPath + '"');
            }
        }

        updateDisabledPluginList();
    }

    function deleteButtonClicked(aEvent) {
        if (aEvent.button !== 0)
            return;

        var item = pluginListbox.selectedItem;
        if (!item)
            return;

        var pluginPath = item.value;
        var pluginInfo = pluginInfoHolder[pluginPath];
        var reallyDelete = modules.util.confirm(modules.util.getLocaleString("deletePluginTitle",
                                                                             [pluginInfo.name]),
                                                modules.util.getLocaleString("deletePluginMessage",
                                                                             [pluginInfo.name]));

        if (reallyDelete) {
            var file = modules.util.openFile(pluginPath);
            if (file && file.exists()) {
                try {
                    modules.userscript.uninstallPlugin(file);
                    delete modules.plugins.context[pluginPath];
                    pluginListbox.removeItemAt(pluginListbox.selectedIndex);
                    modules.display.notify(modules.util.getLocaleString("pluginDeleted"));
                } catch (x) {}
            }
        }
    }

    function selectNewlyInstalledPlugin() {
        var holder = xulHolder[modules.userscript.newlyInstalledPlugin];
        if (holder && holder.item) {
            pluginListbox.selectedItem = holder.item;
        }

        modules.display.notify(modules.util.getLocaleString("newPluginInstalled"));
    }

    function getNotCompatibleMessage(aPluginPath) {
        var current = modules.userscript.parent.version;

        return modules.util.getLocaleString("notCompatiblePlugin", [current]);
    }

    var self = {
        onLoad: function () {
            pluginDescriptionFrame = document.getElementById("plugin-description");
            pluginListbox          = document.getElementById("plugin-listbox");

            iframeDoc = pluginDescriptionFrame.contentDocument;
            container = iframeDoc.getElementById("container");
            helpBox   = iframeDoc.getElementById("help-box");
            infoBox   = iframeDoc.getElementById("info-box");
            detailBox = iframeDoc.getElementById("detail-box");

            parserContext = {};

            if (!modules || !modules.userscript)
            {
                // KeySnail not loaded

                var pluginArea = document.getElementById("plugin-area");
                pluginArea.setAttribute("hidden", true);

                removeAllChilds(container);
                container.appendChild(createElementWithText("h1", "Please reload this page"));
                container.appendChild(iframeDoc.createElement("hr"));
                container.appendChild(createElementWithText("p", "Plugin manager does not loaded properly. Please refresh this page."));

                var form   = iframeDoc.createElement("form");
                form.setAttribute("style", "text-align:center;margin:auto;");
                var button = iframeDoc.createElement("input");
                button.setAttribute("style", "font-size:140%;");
                button.setAttribute("type", "button");
                button.setAttribute("value", "Refresh");
                button.setAttribute("onclick", "content.document.location.reload();");
                form.appendChild(button);
                container.appendChild(form);

                return;
            }

            // Check if plugin directory is specified
            if (!modules.userscript.pluginDir)
                modules.userscript.setDefaultPluginDirectory();

            // load Wiki parser
            try {
                Components.utils.import("resource://keysnail-share/WikiParser.js", parserContext);
            } catch (x) {
                modules.message(x);
            }

            initPluginList();

            /**
             * When plugin manager is opened from userscript.loadPlugin(),
             */
            if (modules.userscript.newlyInstalledPlugin) {
                selectNewlyInstalledPlugin();
                modules.userscript.newlyInstalledPlugin = null;
            } else {
                prettifyAll();
            }
        },

        selectPlugin: function (aNext) {
            var current = pluginListbox.selectedIndex;

            if (current < 0)
            {
                if (pluginListbox.itemCount === 0)
                    return;

                pluginListbox.selectedIndex = 0;
            }
            else
            {
                var max = pluginListbox.itemCount;
                var next = current + (aNext ? 1 : -1);
                next = (next < 0) ? max - 1 : next % max;

                pluginListbox.selectedIndex = next;
            }

            pluginListbox.ensureIndexIsVisible(pluginListbox.selectedIndex);
        },

        pluginListboxOnSelect: function (aEvent) {
            // detail
            var item               = aEvent.target;
            var selectedPluginPath = item.value;
            var selectedPluginInfo = pluginInfoHolder[selectedPluginPath];
            var selectedPluginXULs = xulHolder[selectedPluginPath];

            helpBox.setAttribute("style", "display:none;");

            if (selectedPluginInfo.status == KS_PLUGIN_NOTCOMPATIBLE) {
                selectedPluginXULs.notification.value = getNotCompatibleMessage(selectedPluginPath);
            }

            updateInfoBox(selectedPluginPath);
            updateDetailBox(selectedPluginPath);
            iframeDoc.body.scrollTop = 0;
        },

        reloadPlugin: function () {
            modules.plugins.context = {};
            modules.userscript.loadPlugins(true /* ignore cache */);

            helpBox.removeAttribute("style");
            infoBox.innerHTML   = "";
            detailBox.innerHTML = "";

            initPluginList();
        },

        installPlugin: function () {
            var nsIFilePicker = Components.interfaces.nsIFilePicker;
            var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

            fp.init(window, modules.util.getLocaleString("selectPluginFile"), nsIFilePicker.modeOpen);

            if (!modules.util.getSystemInfo().getProperty("name").match("mac")) {
                fp.appendFilter(modules.util.getLocaleString("keySnailPlugin"), "*.ks.js");
            }
            fp.appendFilter("JavaScript","*.js");

            var response = fp.show();
            if (response !== nsIFilePicker.returnOK) {
                return;
            }

            try {
                modules.userscript.installPluginFromURL(modules.util.pathToURL(fp.file.path), function (succeeded) {
                    if (succeeded) {
                        initPluginList();
                        if (modules.userscript.newlyInstalledPlugin) {
                            selectNewlyInstalledPlugin();
                            modules.userscript.newlyInstalledPlugin = null;
                        }
                    }
                });
            } catch (x) {
                modules.display.notify(x);
            }
        },

        checkForAllUpdates: function () {
            let { pluginUpdater } = modules.share;

            if (pluginUpdater.checking)
                modules.display.echoStatusBar(
                    modules.util.getLocaleString("updaterAlreadyRunning"), 3000
                );
            else
                pluginUpdater.checkAndAlert();
        },

        onFinish: function () {
            return true;
        },

        onEditFileClicked: function (ev) {
            let item = pluginListbox.selectedItem;
            if (!item)
                return;

            let path = item.value;

            modules.userscript.editFile(path);
        },

        onShowFolderClicked: function (ev) {
            let item = pluginListbox.selectedItem;
            if (!item)
                return;

            let path = item.value;
            let file = modules.util.openFile(path);

            file.parent.QueryInterface(Components.interfaces.nsILocalFile).launch();
        },

        onViewFileClicked: function (ev) {
            let item = pluginListbox.selectedItem;
            if (!item)
                return;

            let pluginPath     = item.value;
            let pluginLocalURL = modules.util.pathToURL(pluginPath);

            this.gBrowser.loadOneTab(pluginLocalURL, null, null, null, false);
        },

        onViewRemoteFileClicked: function (ev) {
            let item = pluginListbox.selectedItem;
            if (!item)
                return;

            let pluginPath = item.value;
            let pluginInfo = pluginInfoHolder[pluginPath];
            let updateURL  = pluginInfo.updateURL;

            if (updateURL)
                this.gBrowser.loadOneTab(updateURL, null, null, null, false);
            else
                alert("Plugin " + pluginInfo.name + " doesn't have an updateURL");
        },

        onReloadPluginClicked: function (ev) {
            let item = pluginListbox.selectedItem;
            if (!item)
                return;

            let pluginPath = item.value;
            let pluginInfo = pluginInfoHolder[pluginPath];
            let pluginFile = modules.util.openFile(pluginPath);

            let before = Date.now();
            modules.userscript.loadPlugin(pluginFile, true /* ignore cache */);
            let after = Date.now();

            modules.display.echoStatusBar(
                modules.util.format(
                    "Reloaded plugin \"%s\". Took %s msec.",
                    pluginInfo.name,
                    after - before
                )
            );
        },

        set modules(aModules) {
            modules = aModules;
        }
    };

    return self;
})();

(function () {
     var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
         .getService(Components.interfaces.nsIWindowMediator);
     var browserWindow = wm.getMostRecentWindow("navigator:browser");
     ksPluginManager.modules = (browserWindow.KeySnail || {modules : null}).modules;

     ksPluginManager.gBrowser = browserWindow.gBrowser;
 })();
