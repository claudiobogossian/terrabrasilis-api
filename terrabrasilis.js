const { Stack, Queue } = require('terrabrasilis-util');

/**
 * This class use the Revealing Module Pattern.
 * 
 * https://scotch.io/bar-talk/4-javascript-design-patterns-you-should-know#module-design-pattern
 */
var Terrabrasilis = (function(){
    /**
     * variables
     */
    let map;
    let mapScaleStack;
    let redoScaleQueue;
    let baseLayersToShow;
    let overLayersToShow;
    let layerControl;
    let defaultLat = -52.685277;
    let defaultLon = -11.678782;
    let defaultZoom = 5;
    let defaultMapContainer = 'map';
    let constants = {
        TERRABRASILIS_MAPS_GWC: "http://terrabrasilis.info/fip-service/gwc/service/wms",
        TERRABRASILIS_MAPS_WMS: "http://terrabrasilis.info/fip-service/wms",
        FIPCERRADO_OPERACAO: "http://fipcerrado.dpi.inpe.br:8080/fipcerrado-geoserver/wms",
        FEATURE_INFO_PARAMS: "{0}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS={1}QUERY_LAYERS={2}&STYLES=BBOX={3}&FEATURE_COUNT=" +
            "&WIDTH={4}&HEIGHT={5}&FORMAT=&INFO_FORMAT={6}&SRS=EPSG:4326&X={7}&Y={8}",
    };
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Terrabrasilis map
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * this method start the mount terrabrasilis map
     * 
     * @param {*} lat 
     * @param {*} lon 
     * @param {*} zoom 
     */
    let mountMap = function(lat, lon, zoom, container) {
        if(typeof(lat) == 'undefined' || lat === null)
           lat = defaultLat;
        
        if(typeof(lon) == 'undefined' || lon === null)
           lon = defaultLon;
        
        if(typeof(zoom) == 'undefined' || zoom === null)
           zoom = defaultZoom;
        
        if(typeof(container) == 'undefined' || container === null)
           container = defaultMapContainer;

        //icons: https://icons8.com/icon/set/map/metro   
        map = L.map(container, {
            scrollWheelZoom:true,
            fullscreenControl: {
                pseudoFullscreen: false
            },
            contextmenu: true,
            contextmenuWidth: 200,
            contextmenuItems: [{
                text: 'Show coordinates',
                icon: '../../../../assets/img/leaflet/context.menu/whereiam.png',
                callback: showCoordinates
            }, {
                text: 'Center map here',
                icon: '../../../../assets/img/leaflet/context.menu/center.png',
                callback: centerMap 
            }, '-', {
                text: 'GetFeatureInfo',
                icon: '../../../../assets/img/leaflet/context.menu/info.png',
                callback: getLayerFeatureInfo
            }]
        }).setView([lon, lat], zoom);
        
        localStorage.setItem("lat", lat);
        localStorage.setItem("lon", lon);
        localStorage.setItem("zoom", zoom);

        mapScaleStack = Stack;
        redoScaleQueue = Queue;

        mapScaleStack.insert(zoom)
        redoScaleQueue.insert(zoom);
        map.on('zoomend', function() {                        
            mapScaleStack.insert(map.getZoom());
            redoScaleQueue.insert(map.getZoom());
            console.log("add scale -> " + map.getZoom());
        });

        return this;
    }

    /**
     * This method is used to mount all base layers to use in the terrabrasilis map     
     */ 
    let mountBaseLayers = function() {        
        var openstreetmap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ',
            maxZoom: 18,
            minZoom: 4
        });

        var openStreetMapBlackAndWhite = L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,        
            minZoom: 4
        });

        var empty = L.tileLayer('');

        var googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        });

        var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        });

        var googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        });

        var googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        });

        var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        });

        var baseLayers = {
            'Blank': empty,
            'OSM' : openstreetmap,
            'OSM-Black' : openStreetMapBlackAndWhite,
            'Google-Satellite' : googleSat,
            'Google-Hybrid' : googleHybrid,
            'Google-Streets' : googleStreets,
            'Google-Terrain' : googleTerrain,
            'OpenTopoMap' : OpenTopoMap
        }

        baseLayersToShow = baseLayers;

        // define the openstreetmap as main map layer    
        //baseLayersToShow['OSM-Black'].addTo(map);
        baseLayersToShow['OpenTopoMap'].addTo(map);

        return this;
    }

    /**
     * This method is used to mount all overlayers to use in the terrabrasilis map     
     */
    let mountOverLayers = function() {
        /**
         * Terrabrasilis Maps Service
         */
        var forest_2016 = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:forest_2016',
            format: 'image/png',
            transparent: true
        });

        var forest_2017 = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:forest_2017',
            format: 'image/png',
            transparent: true
        });

        var deforestation = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:yearly_deforestation_2013_2017',
            format: 'image/png',
            transparent: true
        });

        var deforestation19882012 = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:accumulated_deforestation_1988_2012',
            format: 'image/png',
            transparent: true
        });

        var hydrography = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:hydrography',
            format: 'image/png',
            transparent: true
        });

        var noForest = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:no_forest',
            format: 'image/png',
            transparent: true
        });

        var cloud2016 = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:cloud_2016',
            format: 'image/png',
            transparent: true
        });

        var cloud2017 = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:cloud_2017',
            format: 'image/png',
            transparent: true
        });

        var amazon_legal_limit = L.tileLayer.wms(constants.TERRABRASILIS_MAPS_GWC, {
            layers: 'fip-project-prodes:brazilian_legal_amazon',
            format: 'image/png',
            transparent: true
        });

        /**
         * Cbers4 AWFI
         */
        var cbers4_virtual_mosaic = L.tileLayer.wms(constants.FIPCERRADO_OPERACAO, {
            layers: 'terraamazon:Cbers4_virtual_mosaic',
            format: 'image/png',
            transparent: true
        });

        var resourcesat2_virtual_mosaic = L.tileLayer.wms(constants.FIPCERRADO_OPERACAO, {
            layers: 'terraamazon:Resourcesat2_virtual_mosaic',
            format: 'image/png',
            transparent: true
        });

        var landsat8_virtual_mosaic = L.tileLayer.wms(constants.FIPCERRADO_OPERACAO, {
            layers: 'terraamazon:Landsat8_virtual_mosaic',
            format: 'image/png',
            transparent: true
        });

        var overlayersGroup = L.layerGroup([forest_2016, deforestation, deforestation19882012, amazon_legal_limit, noForest]);
        
        var overLayers = {
            'Products' : overlayersGroup,
            'Hydrography' : hydrography,
            'No Forest' : noForest,        
            'Cloud 2016' : cloud2016,
            'Cloud 2017' : cloud2017,
            'Forest 2016' : forest_2016,
            'Forest 2017 (Parcial 95 cenas)': forest_2017,
            'Deforestation' : deforestation,
            'Deforestation 1988_2012' : deforestation19882012,
            'Legal Amazon' : amazon_legal_limit,
            'Cbers4 AWFI Virtual Mosaic' : cbers4_virtual_mosaic,
            'ResourceSat2 Virtual Mosaic' : resourcesat2_virtual_mosaic,
            'Landsat8_virtual_mosaic' : landsat8_virtual_mosaic
        }

        overLayersToShow = overLayers;

        // define a layer to be the actived layer    
        overLayersToShow['Products'].addTo(map);

        return this;
    }

    /**
     * this method allow to use the draw tools
     */
    let enableDrawnFeature = function() {
        /**
         * Drawn feature
         */
        let drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        let options = {
            draw: {
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e100', 
                    message: '<strong>Oh snap!<strong> you can\'t draw that!'
                  },
                  shapeOptions: {
                    clickable: true,
                    showArea: true,
                    color: '#bada55'
                  },
                  showArea: true
                },
                polyline: {
                  shapeOptions: {
                    clickable: true,
                    showArea: true,
                    color: '#f357a1',
                    weight: 7
                  },
                  showArea: true
                },
                rectangle: {
                  shapeOptions: {
                    clickable: true,
                    showArea: true
                  },
                  showArea: true
                },
                circle: false
              },
              metric: true,
              edit: {
                featureGroup: drawnItems,
                edit: true,
                remove: true,
                buffer: {
                    replace_polylines: false,
                    separate_buffer: true,
                    buffer_style: {
                      //renderer: renderer,
                      //color: color,
                      weight: 5,
                      fillOpacity: 0,
                      dashArray: '5, 20'
                    }                
               }
            }
        }

        let drawControl = new L.Control.Draw(options);
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, function(event) {
            let type = event.layerType,  
                layer = event.layer;                        
            //console.log(type);
            //console.log(JSON.stringify(layer.toGeoJSON()));           
            //console.log(toWKT(layer));
            drawnItems.addLayer(layer);
        });
        
        map.on(L.Draw.Event.EDITED, function(event) {
            const editedLayers = event.layers;
            editedLayers.eachLayer(function(l) {
                let wkt = getTerraformerWKT(l);                                              
                console.log(wkt);
            });
        });

        map.on(L.Draw.Event.DELETED, function(event) {
            const deletedLayers = event.layers;
            
            deletedLayers.eachLayer(function(l) {                
                drawnItems.removeLayer(l);
                console.log("Deleting feature: ", l);
            });
        });

        return this;
    }

    /**
     * this method enable the leaflet layers control
     */
    let enableLayersControl = function() {
        var options = {
            sortLayers : true,
            collapsed : true
        }
        layerControl = L.control.layers(baseLayersToShow, overLayersToShow, options).addTo(map);

        return this;
    }

    /**
     * this method enable the scale leaflet control
     */
    let enableScaleControl = function() {
        L.control.scale().addTo(map); 

        return this;
    }

    /**
     * this method enable search location using esri-leaflet plugin
     */
    let enableGeocodingControl = function () {
        let searchControl = L.esri.Geocoding.geosearch().addTo(map);

        let results = L.layerGroup().addTo(map);

        searchControl.on('results', function(data){
            results.clearLayers();
            console.log(data);
            for (var i = data.results.length - 1; i >= 0; i--) {
                results.addLayer(
                    L.marker(data.results[i].latlng)
                        .bindPopup('<strong>'+ data.results[i].properties.LongLabel +'</strong>'
                                   + '<br>[ ' + data.results[i].latlng.lat + ' ][ ' + data.results[i].latlng.lng + ' ]')
                );
            }

            setTimeout(function(){ 
                console.log("cleaning the search result layer");
                results.clearLayers();
            }, 10000);
        });

        return this;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // General tools
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * this method allow to resetView to the initial lat, lon and zoom given by user
     */
    let resetMapToInitialView = function() {
        map.setView([
            localStorage.getItem("lon"),
            localStorage.getItem("lat")],
            localStorage.getItem("zoom"));

        mapScaleStack.reset();
        redoScaleQueue.reset();
        console.log("Reset stack and queue.");
    } 
    
    /**
     * this method allow do the fullscreen
     */
    let goToFullscreen = function() {
        if(map.isFullscreen()){            
            map.toggleFullscreen();
        } else {            
            map.toggleFullscreen();
        }    
    }    

    /**
     * This method return the layer geoJSON data
     * 
     * @param layer 
     */
    let getGeoJSON = function (layer) {
        return layer.toGeoJSON();
    }

    /**
     * http://terraformer.io/
     * 
     * This method receive a WKT string and return the Terraformer GeoJSON
     * 
     * @param wkt 
     */
    let getTerraformerGeoJSON = function (wkt) {
        return Terraformer.WKT.parse(wkt);
    }

    /**
     * http://terraformer.io/
     * 
     * This method receive a GeoJSON string and return the Terraformer WKT
     * 
     * @param layer 
     */
    let getTerraformerWKT = function (layer) {
        return Terraformer.WKT.convert(layer.toGeoJSON().geometry);
    }

    /**
     * This method receive a layer object and return the WKT string 
     * 
     * @param layer 
     */
    let toWKT = function (layer) {
        let lng, lat, coords = [];
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            let latlngs = layer.getLatLngs();
            for (let i = 0; i < latlngs.length; i++) {   
                let latlng = latlngs[i];            
                if(latlng.length){
                    for(let j = 0; j < latlng.length; j++){                    
                        coords.push(latlng[j].lng + " " + latlng[j].lat);               
                        if (j === 0) {
                            lng = latlng[j].lng;
                            lat = latlng[j].lat;
                        }
                    }
                } else {
                    if (i === 0) {
                        lng = latlngs[i].lng;
                        lat = latlngs[i].lat;
                    }
                }
            };
            if (layer instanceof L.Polygon) {
                return "POLYGON((" + coords.join(",") + "," + lng + " " + lat + "))";
            } else if (layer instanceof L.Polyline) {
                return "LINESTRING(" + coords.join(",") + ")";
            }
        } else if (layer instanceof L.Marker) {
            return "POINT(" + layer.getLatLng().lng + " " + layer.getLatLng().lat + ")";
        }
    }

    /**
     * This method show the lat lon - just test with context menu
     * 
     * @param event 
     */
    let showCoordinates = function (event) {
        alert(event.latlng);
    }

    /**
     * This method centralizes the map in the clicked point
     * 
     * @param event 
     */
    let centerMap = function (event) {
        this.setView([event.latlng.lat, event.latlng.lng], localStorage.getItem("zoom"));
    }

    /**
     * This method back to the last scale position
     * 
     * @param {*} event 
     */
    let undo = function (event) {
        let letsGoTo = mapScaleStack.remove();
        console.log("undo to -> " + letsGoTo);
        map.setView([
            localStorage.getItem("lon"),
            localStorage.getItem("lat")],
            letsGoTo);     
    }

    /**
     * This method allow walking in undo and redo scale map
     * 
     * @param {*} event 
     */
    let redo = function (event) {
        let letsGoTo = redoScaleQueue.remove();
        console.log("redo to -> " + letsGoTo);
        map.setView([
            localStorage.getItem("lon"),
            localStorage.getItem("lat")],
            letsGoTo);       
    }

    /**
     * This method get the feature layer info (just selected layers)
     * 
     * @param event 
     */
    // let getLayerFeatureInfo = function (event) {
    //     let popup = new L.Popup({ 
    //         maxWidth: 400
    //     });

    //     /**
    //      * get values
    //      */
    //     let latLngStr = "(" + event.latlng.lat + ", " + event.latlng.lng + ")";
    //     let bbox = this.getBounds()._southWest.lng + ", " + this.getBounds()._southWest.lat + ", " 
    //                     + this.getBounds()._northEast.lng + ", " + this.getBounds()._northEast.lat;
    //     let width = this.getSize().x;
    //     let height = this.getSize().y; 
    //     let X = this.layerPointToContainerPoint(event.layerPoint).x;
    //     let Y = this.layerPointToContainerPoint(event.layerPoint).y; 
        
    //     /**
    //      * create the URL string
    //      */
    //     let result = [];
    //     this.eachLayer(layer => { 
    //         if(layer.options.layers) {
    //             console.log(layer);
    //             result.push(constants.FEATURE_INFO_PARAMS
    //                             .replace(/\{0\}/g, getHost(layer._url))
    //                             .replace(/\{1\}/g, layer.options.layers)
    //                             .replace(/\{2\}/g, layer.options.layers)
    //                             .replace(/\{3\}/g, bbox)
    //                             .replace(/\{4\}/g, width)
    //                             .replace(/\{5\}/g, height)
    //                             .replace(/\{6\}/g, "application/json")
    //                             .replace(/\{7\}/g, X.toFixed(0))
    //                             .replace(/\{8\}/g, Y.toFixed(0)));
    //         }
    //     });

    //     popup.setLatLng(event.latlng);

    //     let resultJson = [];
    //     result.forEach(item => {
    //         console.log(item);
    //         $.ajax({
    //             url: item,
    //             datatype: "json",
    //             type: "GET",
    //             success: function(data) {		    
    //                 resultJson.push(data);
    //             }
    //        });      
    //         //popup.setContent("<iframe src='"+ item +"' width='550' height='250' frameborder='0'></iframe>");            
    //     });

    //     console.log(resultJson);
                
    //     //popup.setContent("<iframe src='"+ urlGetfeatureInfo +"' width='550' height='250' frameborder='0'></iframe>");
    //     //popup.setContent("");
    //     this.openPopup(popup);
    // }

    /**
     * This method get the feature layer info (just selected layers)
     * 
     * @param event 
     */
    let getLayerFeatureInfo = function (event) {
        let urls = getFeatureInfoUrl(event),
            showResults = L.Util.bind(showGetFeatureInfo, this);
        
        // urls.forEach(url => {
        //     $.ajax({
        //         url: url,
        //         success: function (data, status, xhr) {
        //             var err = typeof data === 'string' ? null : data;
    
        //             showResults(err, event.latlng, data);
        //         },
        //         error: function (xhr, status, error) {
        //             showResults(error);  
        //         }
        //     });    
        // });    
                
        showResults(null, event.latlng, urls);
        
        /**
         * deprecated
         */
        // let html="";
        // result.forEach(_url => {
        //     // $.ajax({
        //     //     url: _url,
        //     //     datatype: "json",
        //     //     type: "GET",
        //     //     success: function(data) {
        //     //         console.log(data);		    
        //     //         var feature = data.features[0];   
                                 
        //     //         L.popup({
        //     //             maxWidth:400
        //     //         }).setLatLng(event.latlng)
        //     //         .setContent(L.Util.template("", feature.properties))
        //     //         .openOn(map);
        //     //         }
        //     //     });                                                        
        // });
    }

    /**
     * treats the layers url to get feature info
     * 
     * @param {*} event 
     */
    let getFeatureInfoUrl = function (event) {
        let point = map.latLngToContainerPoint(event.latlng, map.getZoom()), 
            size = map.getSize(),
            bounds = map.getBounds();

        let result = [];
        map.eachLayer(layer => {        
            //console.log(layer);
            let iframeTemplate = "<iframe src='#url#' width='450' height='auto' frameborder='0'></iframe>";
            let match = /gwc\/service/;                    
            if(layer.options.layers) {
                defaultParams = {
                    request: 'GetFeatureInfo',
                    service: 'WMS',
                    //srs: layer._crs.code,
                    srs: 'EPSG:4326',
                    styles: layer.wmsParams.styles,
                    transparent: layer.wmsParams.transparent,
                    //transparent:true,
                    version: layer.wmsParams.version,      
                    format: layer.wmsParams.format,
                    format:'',
                    bbox: bounds.toBBoxString(),
                    height: size.y.toFixed(0),
                    width: size.x.toFixed(0),
                    layers: layer.wmsParams.layers,
                    query_layers: layer.wmsParams.layers,
                    //info_format: 'text/html'
                };

                paramsOptions = {
                    //'info_format': 'application/json',
                    'info_format': 'text/html',
                    //'propertyName': 'NAME,AREA_CODE,DESCRIPTIO'
                }

                params = L.Util.extend(defaultParams, paramsOptions || {});
        
                params[params.version === '1.3.0' ? 'i' : 'x'] = point.x;
                params[params.version === '1.3.0' ? 'j' : 'y'] = point.y;                
                
                let url = match.test(layer._url) == true 
                    ? layer._url.replace("gwc/service", layer.wmsParams.layers.split(':')[0]) : layer._url;                
                result.push(iframeTemplate.replace("#url#", url + L.Util.getParamString(params, url, true)));    
                //result.push(url + L.Util.getParamString(params, url, true));            
            }
        }); 
        return result;
    }

    /**
     * show a popup to getfeature info
     * 
     * @param {*} err 
     * @param {*} latlng 
     * @param {*} content 
     */
    let showGetFeatureInfo = function (err, latlng, content) {
        if (err) { console.log(err); return; } 

        L.popup({ maxWidth:500 })
           .setLatLng(latlng)
           .setContent(content.join(""))
           //.setContent(content)
           .openOn(map);
    }

    /**
     * return the selected layers
     */
    let getIdentifyLayers = function () {
        let result = [];
        map.eachLayer(layer => {        
            console.log(layer);
            if(layer.options.layers) {
                result.push(layer.options.layers);
            }
        });

        return result;
    }

    /**
     * This method iterate under layerControl layers and identify the overlayers
     */
    let getTerrabrasilisOverlayers = function () {
        let result = [];
        let overlayers = layerControl._layers;

        for(var i = 0; i < overlayers.length; i++) {
            let overlayer = overlayers[i];
            if(typeof(overlayer.overlay) != 'undefined' || overlayer.overlay === true) {
                result.push(overlayer);
            }
        }

        return result;
    }

    /**
     * This method iterate under layerControl layers and identify the baselayers
     */
    let getTerrabrasilisBaselayers = function () {
        let result = [];
        let baselayers = layerControl._layers;

        for(var i = 0; i < baselayers.length; i++) {
            let baselayer = baselayers[i];
            if(typeof(baselayer.overlay) === 'undefined') {
                result.push(baselayer);
            }
        }

        return result;
    }

    /**
     * This method receive the objet with information to add layer on the map dinamically
     * 
     *  {
     *      geospatialHost:  'value',
     *      workspace:       'value',
     *      layerName:       'value',
     *      active:          'value',
     *  }
     * 
     * @param {*} layerOptions 
     */
    let addLayerByGetCapabilities = function (layerOptions) {
        
        if(layerOptions === 'undefined' || layerOptions == null || layerOptions === '') {
            alert("No data to add layer on the map!");
            return;
        }
       
        let options = layerOptions;

        //console.log(options);

        let layer = L.tileLayer.wms(options.geospatialHost, {
            layers:  options.workspace + ':' + options.layerName,
            format: 'image/png',
            transparent: true
        });

        layerControl.addOverlay(layer, options.layerName);
        map.addLayer(layer);
        //console.log(layerControl);       
    }

    /**
     * This method return the currently map
     */
    let getCurrentlyMap = function () {
        return map;
    }

    /**
     * This method return just the host to get feature info
     * 
     * @param host 
     */
    // let getHost = function (host) {        
    //     console.log(host);

    //     let match = /gwc/;
    //     let newHost;
    //     if(match.test(host))
    //         newHost = host
    //                     .replace("gwc/", "")
    //                     .replace("/wms", "");
        
    //     console.log(newHost);        
    //     return newHost;
    // }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // return
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * return
     * 
     * That return allow the client of this object invoke some method like: Terrabrasilis.mountMap()
     */
    return {
        /**
         * mount map and enable tools, these methods use the fluent interface concepts
         */
        map: mountMap, 
        addBaseLayers: mountBaseLayers,
        addOverLayers: mountOverLayers,
        enableDrawFeatureTool: enableDrawnFeature,
        enableLayersControlTool:  enableLayersControl,
        enableScaleControlTool:  enableScaleControl,
        enableGeocodingTool: enableGeocodingControl,

        /**
         * general tools
         */
        resetMap: resetMapToInitialView,
        fullScreen: goToFullscreen,
        undo: undo,
        redo: redo,
        getCurrentlyMap: getCurrentlyMap,
        addLayerByGetCapabilities: addLayerByGetCapabilities,
        getTerrabrasilisOverlayers: getTerrabrasilisOverlayers,
        getTerrabrasilisBaselayers: getTerrabrasilisBaselayers,
    }
     
})(Terrabrasilis || {});

module.exports = Terrabrasilis;