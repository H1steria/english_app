import sys
import json
from pathlib import Path

def get_term(entry):
    """Obtiene el término clave de la entrada, soportando 'word', 'phrasal_verb' y 'sentence'."""
    if isinstance(entry, dict):
        return entry.get("word") or entry.get("phrasal_verb") or entry.get("sentence")
    return None

def reorder_entry(entry):
    """Reordena las claves del esquema y elimina aquellas con valor null (None)."""
    if not isinstance(entry, dict):
        return entry
    
    # Orden exacto deseado para las claves conocidas
    key_order = [
        "word",
        "phrasal_verb",
        "sentence",
        "translations",
        "description",
        "past",
        "image",
        "custom_list",
        "group"
    ]
    
    ordered = {}
    # Insertar claves conocidas ignorando valores null
    for key in key_order:
        if key in entry and entry[key] is not None:
            ordered[key] = entry[key]
            
    # Insertar claves no previstas ignorando valores null
    for key, value in entry.items():
        if key not in ordered and value is not None:
            ordered[key] = value
            
    return ordered

def guardar_json_formateado(datos, ruta_archivo):
    """Guarda los datos en el archivo correspondiente con un formato legible (indent=1)."""
    try:
        with open(ruta_archivo, 'w', encoding='utf-8') as archivo:
            json.dump(datos, archivo, indent=1, ensure_ascii=False)
        print(f"Archivo '{ruta_archivo}' estructurado y guardado correctamente.")
    except Exception as e:
        print(f"No se pudo guardar el archivo '{ruta_archivo}': {e}")

def procesar_duplicados(ruta_json1, ruta_json2):
    """Compara dos JSONs, reporta duplicados y limpia/formatea ambos archivos."""
    print(f"Modo Verificación: Comparando '{ruta_json1.name}' con '{ruta_json2.name}'...")
    
    if not ruta_json1.exists() or not ruta_json2.exists():
        sys.exit("Error: Uno o ambos archivos JSON especificados no existen.")

    try:
        with open(ruta_json1, "r", encoding="utf-8") as f:
            datos1 = json.load(f)
        with open(ruta_json2, "r", encoding="utf-8") as f:
            datos2 = json.load(f)

        # Mapear los términos existentes en el segundo JSON
        palabras_json2 = {
            get_term(item).strip().lower() 
            for item in datos2 
            if isinstance(item, dict) and get_term(item) is not None
        }

        duplicados_encontrados = []
        for item in datos1:
            term = get_term(item)
            if term is not None:
                palabra = term.strip()
                if palabra.lower() in palabras_json2:
                    duplicados_encontrados.append(palabra)

        if duplicados_encontrados:
            print(f"Se encontraron {len(duplicados_encontrados)} duplicados de '{ruta_json1.name}' en '{ruta_json2.name}':")
            for palabra in duplicados_encontrados:
                print(f" - {palabra}")
        else:
            print("No se encontraron elementos duplicados entre ambos archivos.")

        # Reordenar y eliminar valores 'null' de ambos JSONs
        datos1_limpios = [reorder_entry(item) for item in datos1] if isinstance(datos1, list) else reorder_entry(datos1)
        datos2_limpios = [reorder_entry(item) for item in datos2] if isinstance(datos2, list) else reorder_entry(datos2)

        print("\nAplicando formato y eliminando valores 'null'...")
        guardar_json_formateado(datos1_limpios, ruta_json1)
        guardar_json_formateado(datos2_limpios, ruta_json2)

    except Exception as e:
        print(f"Error al analizar duplicados: {e}")
        sys.exit(1)

def main():
    json_files = [Path(arg) for arg in sys.argv[1:] if arg.lower().endswith(".json")]
    
    if not json_files:
        print("Error: Por favor, especifique al menos un archivo JSON.")
        sys.exit(1)

    # Si se especifican 2 o más archivos JSON, ejecutar la búsqueda de duplicados
    if len(json_files) >= 2:
        procesar_duplicados(json_files[0], json_files[1])
        return

    # Procesamiento para un único archivo JSON
    ruta_json = json_files[0]
    if not ruta_json.exists():
        sys.exit(f"Error: El archivo '{ruta_json}' no existe.")

    try:
        with open(ruta_json, "r", encoding="utf-8") as f:
            datos = json.load(f)

        if isinstance(datos, list):
            datos_limpios = [reorder_entry(item) for item in datos]
        elif isinstance(datos, dict):
            datos_limpios = reorder_entry(datos)
        else:
            datos_limpios = datos

        guardar_json_formateado(datos_limpios, ruta_json)

    except Exception as e:
        print(f"Error al procesar el archivo: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()