import sys
import json
from pathlib import Path

def reorder_entry(entry):
    """Garantiza el orden estricto de las claves del esquema."""
    if not isinstance(entry, dict):
        return entry
    
    # Definimos el orden exacto deseado
    key_order = ["word", "phrasal_verb", "sentence", "translations", "description", "past", "image", "custom_list"]
    
    ordered = {}
    # Insertar primero las llaves conocidas en el orden correcto
    for key in key_order:
        if key in entry:
            ordered[key] = entry[key]
            
    # Insertar cualquier otra llave imprevista al final para evitar pérdida de datos
    for key, value in entry.items():
        if key not in ordered:
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

def main():
    # Detectar el primer argumento que sea un archivo JSON
    json_files = [Path(arg) for arg in sys.argv[1:] if arg.lower().endswith(".json")]
    
    if not json_files:
        print("Error: Por favor, especifique un archivo JSON.")
        print("Uso: py script.py archivo.json")
        sys.exit(1)
        
    ruta_json = json_files[0]
    
    if not ruta_json.exists():
        sys.exit(f"Error: El archivo '{ruta_json}' no existe.")

    try:
        with open(ruta_json, "r", encoding="utf-8") as f:
            datos = json.load(f)

        # Aplicar reordenación dependiendo de si es una lista de elementos o un objeto único
        if isinstance(datos, list):
            datos_ordenados = [reorder_entry(item) for item in datos]
        elif isinstance(datos, dict):
            datos_ordenados = reorder_entry(datos)
        else:
            datos_ordenados = datos

        guardar_json_formateado(datos_ordenados, ruta_json)

    except Exception as e:
        print(f"Error al procesar el archivo: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()